import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const loadEnvFile = (envPath, override = false) => {
  if (!existsSync(envPath)) {
    return;
  }

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
    if (override) {
      process.env[key] = value;
    } else {
      process.env[key] ??= value;
    }
  }
};

const serverDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(serverDir, '..');
const rootDir = resolve(backendDir, '..');

[
  resolve(rootDir, '.env'),
  resolve(backendDir, '.env'),
  resolve(process.cwd(), '.env'),
].forEach(p => loadEnvFile(p, false));

[
  resolve(rootDir, '.env.local'),
  resolve(backendDir, '.env.local'),
  resolve(process.cwd(), '.env.local'),
].forEach(p => loadEnvFile(p, true));

if (!process.env.DATABASE_URL && process.env.DB_NAME) {
  const user = encodeURIComponent(process.env.DB_USER ?? 'root');
  const password = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : '';
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const dbPort = process.env.DB_PORT ?? '3306';
  const database = encodeURIComponent(process.env.DB_NAME);

  process.env.DATABASE_URL = `mysql://${user}${password}@${host}:${dbPort}/${database}`;
}

const port = Number(process.env.FINANCE_API_PORT ?? 8787);
const apiBaseUrl = process.env.API_BASE_URL ?? 'https://vertinova.id';
const localApiBaseUrl = `http://127.0.0.1:${port}`;
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 12);

const prisma = new PrismaClient();

const loginAttempts = new Map();

const checkRateLimit = (ip) => {
  const entry = loginAttempts.get(ip);
  if (!entry) return true;
  if (Date.now() > entry.resetAt) { loginAttempts.delete(ip); return true; }
  return entry.count < 5;
};

const recordFailedLogin = (ip) => {
  const now = Date.now();
  const existing = loginAttempts.get(ip);
  if (!existing || now > existing.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    loginAttempts.set(ip, { ...existing, count: existing.count + 1 });
  }
};

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
  const body = JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? Number(v) : v));
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
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

const readNumberEnv = (key, fallback = 0) => {
  const value = Number(process.env[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};

const getConfiguredApiKey = (sourceId) => {
  if (sourceId === 'simpaskor') return process.env.SIMPASKOR_API_KEY ?? '';
  if (sourceId === 'forbasi') return process.env.FORBASI_API_KEY ?? '';
  return '';
};

const verifyExternalApiKey = (request, sourceId) => {
  const expectedApiKey = getConfiguredApiKey(sourceId);

  if (!expectedApiKey) {
    return false;
  }

  const headerName =
    sourceId === 'forbasi' ? process.env.FORBASI_API_KEY_HEADER ?? 'X-API-Key' : 'X-API-Key';
  const providedApiKey = request.headers[headerName.toLowerCase()];

  return providedApiKey === expectedApiKey;
};

const paymentConfigPayload = ({ id, name, adminFee }) => ({
  source: id,
  name,
  amount: adminFee,
  admin_fee: adminFee,
  data: {
    amount: adminFee,
    payment_config: {
      admin_fee: adminFee,
    },
  },
});

const normalizeAmount = (value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    return Number(normalized);
  }

  return Number(value);
};

const firstPresent = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const normalizeDate = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
    const amount = normalizeAmount(candidate);

    if (Number.isFinite(amount)) {
      return amount;
    }
  }

  const rows = [payload?.data, payload?.result, payload?.items, payload?.transactions].find(Array.isArray);

  if (rows) {
    const total = rows.reduce((sum, row) => sum + extractAmount(row), 0);

    if (Number.isFinite(total) && total > 0) {
      return total;
    }
  }

  return 0;
};

const extractWebhookRows = (payload) => {
  const candidates = [
    payload?.items,
    payload?.transactions,
    payload?.data?.items,
    payload?.data?.transactions,
    payload?.result?.items,
    payload?.result?.transactions,
    payload?.details?.tickets,
    payload?.details?.voting,
    payload?.details?.registrations,
    payload?.details?.kta,
    payload?.data?.details?.tickets,
    payload?.data?.details?.voting,
    payload?.data?.details?.registrations,
    payload?.data?.details?.kta,
  ];

  const rows = candidates.find(Array.isArray);
  return rows ?? [payload];
};

const extractExternalId = (payload) =>
  String(
    firstPresent(
      payload?.externalId,
      payload?.external_id,
      payload?.orderId,
      payload?.order_id,
      payload?.midtransOrderId,
      payload?.transactionId,
      payload?.transaction_id,
      payload?.paymentId,
      payload?.payment_id,
      payload?.invoiceId,
      payload?.invoice_id,
      payload?.id,
    ) ?? createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 40),
  );

const extractDescription = (sourceName, payload) =>
  String(
    firstPresent(
      payload?.description,
      payload?.title,
      payload?.eventTitle,
      payload?.clubName,
      payload?.name,
      payload?.type,
      `Pembayaran ${sourceName}`,
    ),
  ).slice(0, 255);

const extractOccurredAt = (payload) =>
  normalizeDate(
    firstPresent(
      payload?.paidAt,
      payload?.paid_at,
      payload?.paymentDate,
      payload?.payment_date,
      payload?.settlementTime,
      payload?.settlement_time,
      payload?.createdAt,
      payload?.created_at,
      payload?.date,
    ),
  );

const resolveApiUrl = (url) => {
  if (!url) {
    return '';
  }

  if (url.startsWith('/api/')) {
    return new URL(url, localApiBaseUrl).toString();
  }

  return new URL(url, apiBaseUrl).toString();
};

const buildSimpaskorUrl = (baseUrl) => {
  if (!baseUrl) return '';
  const year = new Date().getFullYear();
  const url = new URL(resolveApiUrl(baseUrl));
  url.searchParams.set('from', `${year}-01-01`);
  url.searchParams.set('to', `${year}-12-31`);
  url.searchParams.set('includeDetails', 'true');
  return url.toString();
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
      lastSync: row.lastSyncedAt?.toISOString() ?? null,
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
    sourceId: row.sourceId,
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

const fetchWithRetry = async (url, options, retries = 1) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
};

const createSyncTransaction = async (sourceId, sourceName, amount) => {
  if (amount <= 0) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const externalId = `sync-${today.toISOString().slice(0, 10)}`;
  const dateLabel = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  await prisma.financeTransaction.upsert({
    where: { unique_source_external_id: { sourceId, externalId } },
    create: {
      sourceId,
      externalId,
      direction: 'income',
      amount,
      description: `Saldo API ${sourceName} per ${dateLabel}`,
      status: 'terverifikasi',
      occurredAt: today,
    },
    update: { amount },
  });
};

const sourceNames = {
  simpaskor: 'Simpaskor',
  forbasi: 'Forbasi',
};

const applyWebhookTransactions = async (sourceId, payload) => {
  const sourceName = sourceNames[sourceId] ?? sourceId;
  const rows = extractWebhookRows(payload);
  const validRows = rows
    .map((row) => ({
      row,
      amount: extractAmount(row),
      externalId: extractExternalId(row),
      occurredAt: extractOccurredAt(row),
      description: extractDescription(sourceName, row),
    }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);

  if (validRows.length === 0) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId,
        status: 'failed',
        message: `Webhook ${sourceName} diterima tanpa nominal valid.`,
        responsePayload: payload,
      },
    });
    return { inserted: 0, total: 0 };
  }

  let total = 0;
  for (const entry of validRows) {
    total += entry.amount;
    await prisma.financeTransaction.upsert({
      where: { unique_source_external_id: { sourceId, externalId: entry.externalId } },
      create: {
        sourceId,
        externalId: entry.externalId,
        direction: 'income',
        amount: entry.amount,
        description: entry.description,
        status: 'terverifikasi',
        occurredAt: entry.occurredAt,
        rawPayload: entry.row,
      },
      update: {
        amount: entry.amount,
        description: entry.description,
        status: 'terverifikasi',
        occurredAt: entry.occurredAt,
        rawPayload: entry.row,
      },
    });
  }

  const aggregate = await prisma.financeTransaction.aggregate({
    where: { sourceId, direction: 'income', status: 'terverifikasi' },
    _sum: { amount: true },
  });

  await prisma.revenueSource.update({
    where: { id: sourceId },
    data: {
      currentBalance: aggregate._sum.amount ?? 0,
      status: 'sinkron',
      lastSyncedAt: new Date(),
    },
  });

  await prisma.apiSyncLog.create({
    data: {
      sourceId,
      status: 'success',
      message: `Webhook ${sourceName} menyimpan ${validRows.length} transaksi.`,
      responsePayload: payload,
    },
  });

  return { inserted: validRows.length, total };
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
    const response = await fetchWithRetry(resolveApiUrl(url), { headers });
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
    await createSyncTransaction(id, name, result.amount);
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
      url: buildSimpaskorUrl(process.env.SIMPASKOR_BALANCE_URL),
      apiKey: process.env.SIMPASKOR_API_KEY,
      apiKeyHeader: process.env.SIMPASKOR_API_KEY_HEADER ?? 'X-API-Key',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
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

  if (request.method === 'GET' && request.url === '/api/external/simpaskor/payment-config') {
    if (!verifyExternalApiKey(request, 'simpaskor')) {
      json(response, 401, { message: 'API key Simpaskor tidak valid.' });
      return;
    }

    json(
      response,
      200,
      paymentConfigPayload({
        id: 'simpaskor',
        name: 'Simpaskor',
        adminFee: readNumberEnv('SIMPASKOR_ADMIN_FEE', 0),
      }),
    );
    return;
  }

  if (request.method === 'GET' && request.url === '/api/external/kta/payment-config') {
    if (!verifyExternalApiKey(request, 'forbasi')) {
      json(response, 401, { message: 'API key Forbasi tidak valid.' });
      return;
    }

    json(
      response,
      200,
      paymentConfigPayload({
        id: 'forbasi',
        name: 'Forbasi',
        adminFee: readNumberEnv('FORBASI_ADMIN_FEE', 0),
      }),
    );
    return;
  }

  if (request.method === 'POST' && /^\/api\/finance\/webhooks\/(simpaskor|forbasi)$/.test(request.url)) {
    const sourceId = request.url.split('/')[4];

    if (!verifyExternalApiKey(request, sourceId)) {
      json(response, 401, { message: `API key webhook ${sourceId} tidak valid.` });
      return;
    }

    try {
      const payload = await parseBody(request);
      const result = await applyWebhookTransactions(sourceId, payload);
      json(response, 200, {
        ok: true,
        sourceId,
        message: `Webhook ${sourceNames[sourceId]} diproses.`,
        ...result,
      });
    } catch (error) {
      json(response, 400, { message: error instanceof Error ? error.message : 'Webhook tidak valid.' });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/auth/login') {
    const ip = request.socket?.remoteAddress ?? 'unknown';
    if (!checkRateLimit(ip)) {
      json(response, 429, { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' });
      return;
    }
    const result = await login(request);
    if (result.statusCode !== 200) recordFailedLogin(ip);
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
        url: buildSimpaskorUrl(process.env.SIMPASKOR_BALANCE_URL),
        apiKey: process.env.SIMPASKOR_API_KEY,
        apiKeyHeader: process.env.SIMPASKOR_API_KEY_HEADER ?? 'X-API-Key',
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

  if (request.method === 'GET' && /^\/api\/finance\/details\/(simpaskor|forbasi)$/.test(request.url)) {
    const sourceId = request.url.split('/')[4];
    let url = '';
    let apiKey = '';
    let apiKeyHeader = 'X-API-Key';

    if (sourceId === 'simpaskor') {
      const base = buildSimpaskorUrl(process.env.SIMPASKOR_BALANCE_URL);
      if (!base) { json(response, 503, { message: 'URL Simpaskor belum diatur.' }); return; }
      url = base;
      apiKey = process.env.SIMPASKOR_API_KEY ?? '';
    } else {
      const base = process.env.FORBASI_BALANCE_URL;
      if (!base) { json(response, 503, { message: 'URL Forbasi belum diatur.' }); return; }
      const u = new URL(resolveApiUrl(base));
      u.searchParams.set('includeDetails', 'true');
      url = u.toString();
      apiKey = process.env.FORBASI_API_KEY ?? '';
      apiKeyHeader = process.env.FORBASI_API_KEY_HEADER ?? 'X-API-Key';
    }

    try {
      const headers = { Accept: 'application/json' };
      if (apiKey) headers[apiKeyHeader] = apiKey;
      const apiRes = await fetchWithRetry(url, { headers });
      const payload = await apiRes.json().catch(() => ({}));

      if (!apiRes.ok) {
        json(response, 502, { message: `API ${sourceId} mengembalikan status ${apiRes.status}.` });
        return;
      }

      let items = [];
      if (sourceId === 'simpaskor') {
        const d = payload?.details ?? {};
        const tickets = (d.tickets ?? []).map((r) => ({
          id: r.id, type: 'Tiket', title: r.eventTitle ?? '-',
          subtitle: r.eventSlug ?? '', quantity: r.quantity ?? 1,
          adminFee: r.adminFee ?? 0, paidAt: r.paidAt, orderId: r.midtransOrderId,
        }));
        const voting = (d.voting ?? []).map((r) => ({
          id: r.id, type: 'Voting', title: r.eventTitle ?? '-',
          subtitle: r.eventSlug ?? '', quantity: r.voteCount ?? 1,
          adminFee: r.adminFee ?? 0, paidAt: r.paidAt, orderId: r.midtransOrderId,
        }));
        const regs = (d.registrations ?? []).map((r) => ({
          id: r.id, type: 'Pendaftaran', title: r.eventTitle ?? '-',
          subtitle: r.eventSlug ?? '', quantity: 1,
          adminFee: r.adminFee ?? 0, paidAt: r.paidAt, orderId: r.midtransOrderId,
        }));
        items = [...tickets, ...voting, ...regs].sort(
          (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
        );
      } else {
        items = (payload?.details?.kta ?? []).map((r) => ({
          id: String(r.id), type: 'KTA', title: r.clubName ?? '-',
          subtitle: `${r.province ?? ''} — ${r.regency ?? ''}`.trim().replace(/^—|—$/, '').trim(),
          quantity: 1, adminFee: r.adminFee ?? 0, paidAt: r.paidAt, orderId: r.midtransOrderId,
        }));
      }

      json(response, 200, {
        sourceId,
        items,
        total: items.reduce((s, i) => s + i.adminFee, 0),
        count: items.length,
      });
    } catch (error) {
      json(response, 502, { message: error instanceof Error ? error.message : 'Gagal mengambil detail.' });
    }
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/dashboard') {
    const [sources, transactions] = await Promise.all([
      getSourcesFromDb(),
      getTransactionsFromDb(),
    ]);
    const totalIncome = sources.reduce((sum, s) => sum + s.amount, 0);
    const apiIncome = sources.filter((s) => s.category === 'api').reduce((sum, s) => sum + s.amount, 0);
    json(response, 200, { sources, transactions, summary: { totalIncome, apiIncome } });
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
