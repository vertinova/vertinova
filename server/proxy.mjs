import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const envPath = resolve(process.cwd(), '.env.local');

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] ??= value;
  }
}

const port = Number(process.env.FINANCE_API_PORT ?? 8787);
const apiBaseUrl = process.env.API_BASE_URL ?? 'https://vertinova.id';
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 12);

const prisma = new PrismaClient();

const statusMap = {
  sinkron: 'Sinkron',
  api_belum_terhubung: 'API Belum Terhubung',
  manual: 'Manual',
};

const transactionStatusMap = {
  terverifikasi: 'Terverifikasi',
  review: 'Review',
  terjadwal: 'Terjadwal',
};

const ORDER = ['simpaskor', 'forbasi', 'desa', 'sekolah', 'swasta'];

const hashPassword = (password, salt = randomBytes(16).toString('hex')) => {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
  const [salt, hash] = String(storedHash).split(':');

  if (!salt || !hash) {
    return false;
  }

  const passwordHash = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex');
  const storedPasswordHash = Buffer.from(hash, 'hex');

  return (
    passwordHash.length === storedPasswordHash.length &&
    timingSafeEqual(passwordHash, storedPasswordHash)
  );
};

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const json = (response, statusCode, payload) => {
  // Serialize BEFORE writeHead so if stringify throws, headers are not yet sent
  const body = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? Number(v) : v));
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(body);
};

const parseBody = async (request) =>
  new Promise((resolveBody, rejectBody) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk.toString();

      if (body.length > 1_000_000) {
        request.destroy();
        rejectBody(new Error('Payload terlalu besar.'));
      }
    });

    request.on('end', () => {
      if (!body) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('Body harus berupa JSON valid.'));
      }
    });
  });

const getBearerToken = (request) => {
  const authorization = request.headers.authorization ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return '';
  }

  return authorization.slice('Bearer '.length).trim();
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const ensureRevenueSources = async () => {
  const sources = [
    { id: 'simpaskor', name: 'Simpaskor', category: 'api',    color: '#23c483', description: 'Saldo masuk otomatis dari API Simpaskor.', status: 'api_belum_terhubung' },
    { id: 'forbasi',   name: 'Forbasi',   category: 'api',    color: '#3b82f6', description: 'Saldo masuk otomatis dari API Forbasi.',   status: 'api_belum_terhubung' },
    { id: 'desa',      name: 'Desa',      category: 'manual', color: '#f59e0b', description: 'Pendapatan desa belum diisi manual.',        status: 'manual' },
    { id: 'sekolah',   name: 'Sekolah',   category: 'manual', color: '#ef5da8', description: 'Pendapatan sekolah belum diisi manual.',     status: 'manual' },
    { id: 'swasta',    name: 'Swasta',    category: 'manual', color: '#8b5cf6', description: 'Pendapatan swasta belum diisi manual.',      status: 'manual' },
  ];
  for (const s of sources) {
    await prisma.revenueSource.upsert({
      where: { id: s.id },
      create: { ...s, currentBalance: 0 },
      update: { name: s.name, color: s.color, description: s.description },
    });
  }
};

const ensureSuperAdmin = async () => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password) {
    console.warn('SUPER_ADMIN_EMAIL atau SUPER_ADMIN_PASSWORD belum diatur.');
    return;
  }

  await prisma.adminUser.upsert({
    where: { email },
    create: { name, email, passwordHash: hashPassword(password), role: 'super_admin', isActive: true },
    update: { name, passwordHash: hashPassword(password), role: 'super_admin', isActive: true },
  });
  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (user) await prisma.userSession.deleteMany({ where: { userId: user.id } });
};

const authenticate = async (request) => {
  const token = getBearerToken(request);
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  return session.user;
};

const requireAuth = async (request, response) => {
  const user = await authenticate(request);

  if (!user) {
    json(response, 401, { message: 'Sesi tidak valid. Silakan login ulang.' });
    return null;
  }

  return user;
};

const login = async (request) => {
  const body = await parseBody(request);
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return { statusCode: 400, payload: { message: 'Email dan password wajib diisi.' } };

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { statusCode: 401, payload: { message: 'Email atau password salah.' } };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);
  await prisma.userSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return { statusCode: 200, payload: { token, user: sanitizeUser(user), expiresAt: expiresAt.toISOString() } };
};

const logout = async (request) => {
  const token = getBearerToken(request);
  if (token) await prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  return { message: 'Logout berhasil.' };
};

const extractAmount = (payload) => {
  const candidates = [
    payload?.amount,
    payload?.balance,
    payload?.saldo,
    payload?.total,
    payload?.data?.amount,
    payload?.data?.balance,
    payload?.data?.saldo,
    payload?.data?.total,
    payload?.result?.amount,
    payload?.result?.balance,
    payload?.result?.saldo,
    payload?.result?.total,
    payload?.admin_fee,
    payload?.adminFee,
    payload?.fee,
    payload?.price,
    payload?.data?.admin_fee,
    payload?.data?.adminFee,
    payload?.data?.fee,
    payload?.data?.price,
    payload?.data?.payment_config?.admin_fee,
    payload?.data?.paymentConfig?.adminFee,
    payload?.result?.admin_fee,
    payload?.result?.adminFee,
    payload?.result?.fee,
    payload?.result?.price,
    payload?.summary?.totalAdminFee,
    payload?.summary?.total_admin_fee,
    payload?.summary?.adminFee,
    payload?.summary?.total,
  ];

  for (const candidate of candidates) {
    const amount = Number(candidate);

    if (Number.isFinite(amount)) {
      return amount;
    }
  }

  return 0;
};

const resolveApiUrl = (url) => {
  if (!url) {
    return '';
  }

  return new URL(url, apiBaseUrl).toString();
};

const getSourcesFromDb = async () => {
  const rows = await prisma.revenueSource.findMany();
  return rows
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      amount: Number(row.currentBalance),
      status: statusMap[row.status] ?? 'API Belum Terhubung',
      color: row.color,
      description: row.description,
      lastSync: row.lastSyncedAt,
    }));
};

const getTransactionsFromDb = async () => {
  const rows = await prisma.financeTransaction.findMany({
    take: 25,
    orderBy: { occurredAt: 'desc' },
    include: { source: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: `VTF-${String(row.id).padStart(5, '0')}`,
    source: row.source.name,
    description: row.description,
    date: row.occurredAt,
    amount: Number(row.amount),
    status: transactionStatusMap[row.status] ?? 'Review',
  }));
};

const updateSourceSync = async ({ id, amount, status, message, payload }) => {
  const dbStatus = status === 'Sinkron' ? 'sinkron' : status === 'Manual' ? 'manual' : 'api_belum_terhubung';
  await prisma.revenueSource.update({
    where: { id },
    data: {
      currentBalance: amount,
      status: dbStatus,
      ...(dbStatus === 'sinkron' ? { lastSyncedAt: new Date() } : {}),
    },
  });
  await prisma.apiSyncLog.create({
    data: { sourceId: id, status: dbStatus === 'sinkron' ? 'success' : 'failed', message, responsePayload: payload ?? {} },
  });
};

const fetchBalance = async ({ id, name, url, apiKey, apiKeyHeader = 'X-API-Key' }) => {
  if (!url) {
    const result = {
      id,
      amount: 0,
      status: 'API Belum Terhubung',
      message: `URL API ${name} belum diatur di .env.local.`,
    };
    await updateSourceSync({ ...result, payload: {} });
    return result;
  }

  const headers = { Accept: 'application/json' };

  if (apiKey) {
    headers[apiKeyHeader] = apiKey;
  }

  try {
    const response = await fetch(resolveApiUrl(url), { headers });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const result = {
        id,
        amount: 0,
        status: 'API Belum Terhubung',
        message: `API ${name} mengembalikan status ${response.status}.`,
      };
      await updateSourceSync({ ...result, payload });
      return result;
    }

    const result = {
      id,
      amount: extractAmount(payload),
      status: 'Sinkron',
      lastSync: new Date().toISOString(),
      message: `Saldo ${name} berhasil disinkronkan dari API.`,
    };
    await updateSourceSync({ ...result, payload });
    return result;
  } catch (error) {
    const result = {
      id,
      amount: 0,
      status: 'API Belum Terhubung',
      message: error instanceof Error ? error.message : `Gagal menghubungi API ${name}.`,
    };
    await updateSourceSync({ ...result, payload: {} });
    return result;
  }
};

const syncApiSources = async () =>
  Promise.all([
    fetchBalance({
      id: 'simpaskor',
      name: 'Simpaskor',
      url: process.env.SIMPASKOR_BALANCE_URL,
      apiKey: process.env.SIMPASKOR_API_KEY,
    }),
    fetchBalance({
      id: 'forbasi',
      name: 'Forbasi',
      url: process.env.FORBASI_BALANCE_URL,
      apiKey: process.env.FORBASI_API_KEY,
      apiKeyHeader: process.env.FORBASI_API_KEY_HEADER ?? 'X-API-Key',
    }),
  ]);

const route = async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    response.end();
    return;
  }

  if (request.url === '/api/finance/health') {
    await prisma.$queryRaw`SELECT 1`;
    json(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/login') {
    const result = await login(request);
    json(response, result.statusCode, result.payload);
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/logout') {
    json(response, 200, await logout(request));
    return;
  }

  if (request.method === 'GET' && request.url === '/api/auth/me') {
    const user = await requireAuth(request, response);

    if (!user) {
      return;
    }

    json(response, 200, { user: sanitizeUser(user) });
    return;
  }

  const user = await requireAuth(request, response);

  if (!user) {
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/sources') {
    json(response, 200, { sources: await getSourcesFromDb() });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/finance/sync') {
    await syncApiSources();
    json(response, 200, {
      sources: await getSourcesFromDb(),
      transactions: await getTransactionsFromDb(),
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/transactions') {
    json(response, 200, { transactions: await getTransactionsFromDb() });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/simpaskor/balance') {
    json(response, 200, {
      source: await fetchBalance({
        id: 'simpaskor',
        name: 'Simpaskor',
        url: process.env.SIMPASKOR_BALANCE_URL,
        apiKey: process.env.SIMPASKOR_API_KEY,
      }),
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/forbasi/balance') {
    json(response, 200, {
      source: await fetchBalance({
        id: 'forbasi',
        name: 'Forbasi',
        url: process.env.FORBASI_BALANCE_URL,
        apiKey: process.env.FORBASI_API_KEY,
        apiKeyHeader: process.env.FORBASI_API_KEY_HEADER ?? 'X-API-Key',
      }),
    });
    return;
  }

  json(response, 404, { message: 'Endpoint tidak ditemukan.' });
};

process.on('uncaughtException', (error) => {
  console.error('[Vertinova API] Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Vertinova API] Unhandled rejection:', reason);
});

await ensureRevenueSources();
await ensureSuperAdmin();
await prisma.userSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });

createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error('[Vertinova API] Route error:', error);
    if (!response.headersSent) {
      json(response, 500, {
        message: error instanceof Error ? error.message : 'Terjadi kesalahan server.',
      });
    } else if (!response.writableEnded) {
      response.end();
    }
  });
}).listen(port, () => {
  console.log(`[Vertinova API] Running on port ${port}`);
});
