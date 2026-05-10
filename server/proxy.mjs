import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import mysql from 'mysql2/promise';

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

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'vertinova_finance',
  waitForConnections: true,
  connectionLimit: 10,
});

const statusMap = {
  sinkron: 'Sinkron',
  api_belum_terhubung: 'API Belum Terhubung',
  manual: 'Manual',
};

const statusToDb = {
  Sinkron: 'sinkron',
  'API Belum Terhubung': 'api_belum_terhubung',
  Manual: 'manual',
};

const transactionStatusMap = {
  terverifikasi: 'Terverifikasi',
  review: 'Review',
  terjadwal: 'Terjadwal',
};

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
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
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

const ensureSuperAdmin = async () => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!email || !password) {
    console.warn('SUPER_ADMIN_EMAIL atau SUPER_ADMIN_PASSWORD belum diatur.');
    return;
  }

  const [existingRows] = await pool.query('SELECT id FROM admin_users WHERE email = ? LIMIT 1', [
    email,
  ]);

  if (existingRows.length > 0) {
    await pool.query(
      `UPDATE admin_users
       SET name = ?, password_hash = ?, role = 'super_admin', is_active = 1
       WHERE email = ?`,
      [name, hashPassword(password), email],
    );
    await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [existingRows[0].id]);
    return;
  }

  await pool.query(
    `INSERT INTO admin_users (name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, 'super_admin', 1)`,
    [name, email, hashPassword(password)],
  );
};

const authenticate = async (request) => {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT
       au.id,
       au.name,
       au.email,
       au.role
     FROM user_sessions us
     INNER JOIN admin_users au ON au.id = us.user_id
     WHERE us.token_hash = ?
       AND us.expires_at > NOW()
       AND au.is_active = 1
     LIMIT 1`,
    [hashToken(token)],
  );

  return rows[0] ?? null;
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

  if (!email || !password) {
    return { statusCode: 400, payload: { message: 'Email dan password wajib diisi.' } };
  }

  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, role
     FROM admin_users
     WHERE email = ? AND is_active = 1
     LIMIT 1`,
    [email],
  );
  const user = rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { statusCode: 401, payload: { message: 'Email atau password salah.' } };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [user.id, hashToken(token), expiresAt],
  );
  await pool.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  return {
    statusCode: 200,
    payload: {
      token,
      user: sanitizeUser(user),
      expiresAt: expiresAt.toISOString(),
    },
  };
};

const logout = async (request) => {
  const token = getBearerToken(request);

  if (token) {
    await pool.query('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
  }

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

const sourceRowToPayload = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  amount: Number(row.current_balance),
  status: statusMap[row.status] ?? 'API Belum Terhubung',
  color: row.color,
  description: row.description,
  lastSync: row.last_synced_at,
});

const getSourcesFromDb = async () => {
  const [rows] = await pool.query(
    `SELECT id, name, category, current_balance, status, color, description, last_synced_at
     FROM revenue_sources
     ORDER BY FIELD(id, 'simpaskor', 'forbasi', 'desa', 'sekolah', 'swasta')`,
  );

  return rows.map(sourceRowToPayload);
};

const getTransactionsFromDb = async () => {
  const [rows] = await pool.query(
    `SELECT
       ft.id,
       rs.name AS source,
       ft.description,
       ft.amount,
       ft.status,
       ft.occurred_at
     FROM finance_transactions ft
     INNER JOIN revenue_sources rs ON rs.id = ft.source_id
     ORDER BY ft.occurred_at DESC
     LIMIT 25`,
  );

  return rows.map((row) => ({
    id: `VTF-${String(row.id).padStart(5, '0')}`,
    source: row.source,
    description: row.description,
    date: row.occurred_at,
    amount: Number(row.amount),
    status: transactionStatusMap[row.status] ?? 'Review',
  }));
};

const updateSourceSync = async ({ id, amount, status, message, payload }) => {
  const dbStatus = statusToDb[status] ?? 'api_belum_terhubung';
  const responsePayload = JSON.stringify(payload ?? {});

  await pool.query(
    `UPDATE revenue_sources
     SET current_balance = ?, status = ?, last_synced_at = IF(? = 'sinkron', NOW(), last_synced_at)
     WHERE id = ?`,
    [amount, dbStatus, dbStatus, id],
  );

  await pool.query(
    `INSERT INTO api_sync_logs (source_id, status, message, response_payload)
     VALUES (?, ?, ?, CAST(? AS JSON))`,
    [id, dbStatus === 'sinkron' ? 'success' : 'failed', message, responsePayload],
  );
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
    json(response, 204, {});
    return;
  }

  if (request.url === '/api/finance/health') {
    await pool.query('SELECT 1');
    json(response, 200, { ok: true, database: process.env.DB_NAME ?? 'vertinova_finance' });
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

await ensureSuperAdmin();
await pool.query('DELETE FROM user_sessions WHERE expires_at <= NOW()');

createServer((request, response) => {
  route(request, response).catch((error) => {
    json(response, 500, {
      message: error instanceof Error ? error.message : 'Terjadi kesalahan server.',
    });
  });
}).listen(port, () => {
  console.log(`Finance API proxy running at http://localhost:${port}`);
});
