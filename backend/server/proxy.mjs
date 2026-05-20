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

const permissionCatalog = [
  { id: 'finance.dashboard', label: 'Ringkasan dashboard', feature: 'dashboard' },
  { id: 'finance.transactions', label: 'Transaksi', feature: 'transactions' },
  { id: 'finance.reports', label: 'Ekspor laporan', feature: 'reports' },
  { id: 'accounts.manage', label: 'Manajemen akun', feature: 'accounts' },
  { id: 'revenue_shares.manage', label: 'Pembagian persentase', feature: 'revenueShares' },
];

const allPermissionIds = permissionCatalog.map((permission) => permission.id);
const defaultAccountPermissions = ['finance.dashboard'];
const superAdminRoles = new Set(['serigala', 'super_admin']);

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
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

const isSuperAdmin = (user) => superAdminRoles.has(user?.role);

const getPermissionIds = (user) => {
  if (isSuperAdmin(user)) return allPermissionIds;
  return (user?.permissions ?? [])
    .filter((permission) => permission.canUse)
    .map((permission) => permission.permission);
};

const canUse = (user, permission) => isSuperAdmin(user) || getPermissionIds(user).includes(permission);

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  permissions: getPermissionIds(user),
  revenueSharePercent: Number(user.revenueShare?.percentage ?? 0),
});

const serializeManagedUser = (user, totalIncome = 0) => {
  const percentage = Number(user.revenueShare?.percentage ?? 0);
  return {
    ...sanitizeUser(user),
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    revenueShareAmount: Math.round(totalIncome * percentage / 100),
  };
};

const parseUsername = (value) => String(value ?? '').trim().toLowerCase();

const validateUsername = (username) => /^[a-z0-9._-]{3,80}$/.test(username);

const requirePermission = (user, response, permission) => {
  if (canUse(user, permission)) return true;
  json(response, 403, { message: 'Akun ini tidak memiliki akses ke fitur tersebut.' });
  return false;
};

const totalVerifiedIncome = async () => {
  const result = await prisma.financeTransaction.aggregate({
    where: { direction: 'income', status: 'terverifikasi' },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
};

const excludeSyncSnapshots = {
  NOT: { externalId: { startsWith: 'sync-' } },
};

const totalIncomeBySource = async (sourceId) => {
  const result = await prisma.financeTransaction.aggregate({
    where: { sourceId, direction: 'income', ...excludeSyncSnapshots },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
};

const userInclude = {
  permissions: true,
  revenueShare: true,
};

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

const getScalarCount = (rows) => Number(Object.values(rows?.[0] ?? { count: 0 })[0] ?? 0);

const tableExists = async (tableName) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    tableName,
  );
  return getScalarCount(rows) > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    tableName,
    columnName,
  );
  return getScalarCount(rows) > 0;
};

const indexExists = async (tableName, indexName) => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS count FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    tableName,
    indexName,
  );
  return getScalarCount(rows) > 0;
};

const ensureAccessSchema = async () => {
  if (!(await tableExists('admin_users'))) return;

  if (!(await columnExists('admin_users', 'username'))) {
    await prisma.$executeRawUnsafe('ALTER TABLE admin_users ADD COLUMN username VARCHAR(80) NULL AFTER name');
    await prisma.$executeRawUnsafe("UPDATE admin_users SET username = CONCAT('user', id) WHERE username IS NULL OR username = ''");
    await prisma.$executeRawUnsafe('ALTER TABLE admin_users MODIFY username VARCHAR(80) NOT NULL');
  }

  if (!(await indexExists('admin_users', 'admin_users_username_key'))) {
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX admin_users_username_key ON admin_users(username)');
  }

  await prisma.$executeRawUnsafe('ALTER TABLE admin_users MODIFY email VARCHAR(190) NULL');
  await prisma.$executeRawUnsafe("ALTER TABLE admin_users MODIFY role VARCHAR(60) NOT NULL DEFAULT 'admin'");
  await prisma.$executeRawUnsafe("UPDATE admin_users SET role = 'serigala' WHERE role = 'super_admin'");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS account_permissions (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      permission VARCHAR(100) NOT NULL,
      can_use TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_permission (user_id, permission),
      KEY index_permission (permission),
      CONSTRAINT fk_account_permissions_user
        FOREIGN KEY (user_id) REFERENCES admin_users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS revenue_shares (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL UNIQUE,
      percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_revenue_shares_user
        FOREIGN KEY (user_id) REFERENCES admin_users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    )
  `);
};

const ensureAdminFeeSchema = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS admin_fees (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      order_id VARCHAR(120) NOT NULL UNIQUE,
      amount DECIMAL(18, 2) NOT NULL,
      paid_at DATETIME NOT NULL,
      description VARCHAR(255) NOT NULL,
      source VARCHAR(40) NULL,
      raw_payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY index_admin_fees_paid_at (paid_at),
      KEY index_admin_fees_source_paid_at (source, paid_at)
    )
  `);
};

const ensureSuperAdmin = async () => {
  const username = parseUsername(process.env.SUPER_ADMIN_USERNAME ?? 'serigala');
  const email = String(process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase() || null;
  const password = process.env.SUPER_ADMIN_PASSWORD || 'firewall22';
  const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

  if (!validateUsername(username) || !password) {
    console.warn('SUPER_ADMIN_USERNAME atau SUPER_ADMIN_PASSWORD belum valid.');
    return;
  }

  const existingUsers = await prisma.adminUser.findMany({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
    include: userInclude,
  });
  const existingByUsername = existingUsers.find((user) => user.username === username);
  const existingByEmail = email ? existingUsers.find((user) => user.email === email) : null;
  const hasSplitIdentityConflict = Boolean(
    existingByUsername &&
    existingByEmail &&
    existingByUsername.id !== existingByEmail.id
  );
  const passwordHash = hashPassword(password);
  let user;

  if (hasSplitIdentityConflict) {
    console.warn(
      `SUPER_ADMIN_EMAIL sudah digunakan oleh akun "${existingByEmail.username}". ` +
      `Akun "${existingByUsername.username}" tetap dijadikan Super Admin tanpa mengubah email.`
    );
  }

  const existing = existingByUsername ?? existingByEmail;

  if (existing) {
    const data = {
      name,
      username,
      email: hasSplitIdentityConflict ? existing.email : email,
      passwordHash,
      role: 'serigala',
      isActive: true,
    };

    user = await prisma.adminUser.update({
      where: { id: existing.id },
      data,
      include: userInclude,
    });
  } else {
    user = await prisma.adminUser.create({
      data: { name, username, email, passwordHash, role: 'serigala', isActive: true },
      include: userInclude,
    });
  }

  await prisma.accountPermission.deleteMany({ where: { userId: user.id } });
  await prisma.accountPermission.createMany({
    data: allPermissionIds.map((permission) => ({ userId: user.id, permission, canUse: true })),
    skipDuplicates: true,
  });
  await prisma.revenueShare.upsert({
    where: { userId: user.id },
    create: { userId: user.id, percentage: 0 },
    update: {},
  });
  await prisma.userSession.deleteMany({ where: { userId: user.id } });
};

const authenticate = async (request) => {
  const token = getBearerToken(request);
  if (!token) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: userInclude } },
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
  const username = parseUsername(body.username ?? body.email);
  const password = String(body.password ?? '');
  if (!username || !password) return { statusCode: 400, payload: { message: 'Username dan password wajib diisi.' } };

  const user = await prisma.adminUser.findUnique({ where: { username }, include: userInclude });
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return { statusCode: 401, payload: { message: 'Username atau password salah.' } };
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

const normalizePermissions = (permissions, role = 'admin') => {
  if (superAdminRoles.has(role)) return allPermissionIds;
  const allowed = new Set(allPermissionIds);
  const selected = Array.isArray(permissions) ? permissions : defaultAccountPermissions;
  const normalized = selected.filter((permission) => allowed.has(permission));
  return [...new Set(normalized.length ? normalized : defaultAccountPermissions)];
};

const normalizePercentage = (value) => {
  const percentage = Number(value ?? 0);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Persentase harus berupa angka 0 sampai 100.');
  }
  return Math.round(percentage * 100) / 100;
};

const listManagedUsers = async () => {
  const [users, totalIncome] = await Promise.all([
    prisma.adminUser.findMany({
      include: userInclude,
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    }),
    totalVerifiedIncome(),
  ]);

  return {
    permissionCatalog,
    totalIncome,
    users: users.map((user) => serializeManagedUser(user, totalIncome)),
  };
};

const replaceUserPermissions = async (userId, permissions, role = 'admin') => {
  const normalized = normalizePermissions(permissions, role);
  await prisma.accountPermission.deleteMany({ where: { userId } });
  await prisma.accountPermission.createMany({
    data: normalized.map((permission) => ({ userId, permission, canUse: true })),
    skipDuplicates: true,
  });
};

const createManagedUser = async (request) => {
  const body = await parseBody(request);
  const username = parseUsername(body.username);
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase() || null;
  const password = String(body.password ?? '');
  const role = parseUsername(body.role) || 'admin';
  const percentage = normalizePercentage(body.revenueSharePercent);

  if (!name || !validateUsername(username) || password.length < 8) {
    return { statusCode: 400, payload: { message: 'Nama, username valid, dan password minimal 8 karakter wajib diisi.' } };
  }

  if (superAdminRoles.has(role)) {
    return { statusCode: 400, payload: { message: 'Role serigala hanya untuk akun Super Admin utama.' } };
  }

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existing) {
    return { statusCode: 409, payload: { message: 'Username atau email sudah digunakan.' } };
  }

  const user = await prisma.adminUser.create({
    data: { name, username, email, passwordHash: hashPassword(password), role, isActive: true },
  });
  await replaceUserPermissions(user.id, body.permissions, role);
  await prisma.revenueShare.create({ data: { userId: user.id, percentage } });

  return { statusCode: 201, payload: await listManagedUsers() };
};

const updateManagedUser = async (request, userId) => {
  const body = await parseBody(request);
  const current = await prisma.adminUser.findUnique({ where: { id: userId }, include: userInclude });
  if (!current) return { statusCode: 404, payload: { message: 'Akun tidak ditemukan.' } };

  const role = superAdminRoles.has(current.role) ? 'serigala' : (parseUsername(body.role) || current.role || 'admin');
  if (superAdminRoles.has(current.role) && role !== 'serigala') {
    return { statusCode: 400, payload: { message: 'Role Super Admin utama tidak dapat diturunkan.' } };
  }

  const username = body.username === undefined ? current.username : parseUsername(body.username);
  const email = body.email === undefined ? current.email : (String(body.email ?? '').trim().toLowerCase() || null);
  const name = body.name === undefined ? current.name : String(body.name ?? '').trim();

  if (!name || !validateUsername(username)) {
    return { statusCode: 400, payload: { message: 'Nama dan username valid wajib diisi.' } };
  }

  const data = {
    name,
    username,
    email,
    role,
    isActive: body.isActive === undefined ? current.isActive : Boolean(body.isActive),
  };

  if (body.password) {
    const password = String(body.password);
    if (password.length < 8) {
      return { statusCode: 400, payload: { message: 'Password minimal 8 karakter.' } };
    }
    data.passwordHash = hashPassword(password);
  }

  try {
    await prisma.adminUser.update({ where: { id: userId }, data });
  } catch {
    return { statusCode: 409, payload: { message: 'Username atau email sudah digunakan.' } };
  }

  await replaceUserPermissions(userId, body.permissions, role);
  const percentage = body.revenueSharePercent === undefined
    ? Number(current.revenueShare?.percentage ?? 0)
    : normalizePercentage(body.revenueSharePercent);

  await prisma.revenueShare.upsert({
    where: { userId },
    create: { userId, percentage },
    update: { percentage },
  });

  if (!data.isActive) {
    await prisma.userSession.deleteMany({ where: { userId } });
  }

  return { statusCode: 200, payload: await listManagedUsers() };
};

const readNumberEnv = (key, fallback = 0) => {
  const value = Number(process.env[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};

const getConfiguredApiKey = (sourceId) => {
  if (sourceId === 'simpaskor-admin-fee') return process.env.SIMPASKOR_ADMIN_FEE_API_KEY ?? process.env.SIMPASKOR_API_KEY ?? '';
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
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    if (!normalized || normalized === '-' || normalized === '.' || normalized === ',') {
      return Number.NaN;
    }
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

const firstFiniteAmount = (...values) => {
  for (const value of values) {
    const amount = normalizeAmount(value);

    if (Number.isFinite(amount)) {
      return amount;
    }
  }

  return undefined;
};

const extractAdminFeeAmount = (payload) =>
  firstFiniteAmount(
    payload?.totalAdminFee,
    payload?.total_admin_fee,
    payload?.adminFeeTotal,
    payload?.admin_fee_total,
    payload?.summary?.totalAdminFee,
    payload?.summary?.total_admin_fee,
    payload?.summary?.adminFee,
    payload?.summary?.admin_fee,
    payload?.data?.totalAdminFee,
    payload?.data?.total_admin_fee,
    payload?.data?.adminFeeTotal,
    payload?.data?.admin_fee_total,
    payload?.result?.totalAdminFee,
    payload?.result?.total_admin_fee,
    payload?.result?.adminFeeTotal,
    payload?.result?.admin_fee_total,
    payload?.adminFee,
    payload?.admin_fee,
    payload?.fee,
    payload?.data?.adminFee,
    payload?.data?.admin_fee,
    payload?.data?.fee,
    payload?.data?.payment_config?.admin_fee,
    payload?.data?.paymentConfig?.adminFee,
    payload?.result?.adminFee,
    payload?.result?.admin_fee,
    payload?.result?.fee,
  );

const extractDetailRows = (payload) => {
  const detailGroups = [
    payload?.details,
    payload?.data?.details,
    payload?.result?.details,
  ].filter(Boolean);

  return detailGroups.flatMap((details) => [
    ...(Array.isArray(details?.tickets) ? details.tickets : []),
    ...(Array.isArray(details?.voting) ? details.voting : []),
    ...(Array.isArray(details?.registrations) ? details.registrations : []),
    ...(Array.isArray(details?.kta) ? details.kta : []),
  ]);
};

const extractDetailsAdminFeeTotal = (payload) => {
  const rows = extractDetailRows(payload);
  if (rows.length === 0) return undefined;

  let hasAmount = false;
  const total = rows.reduce((sum, row) => {
    const amount = extractAdminFeeAmount(row);
    if (amount === undefined) return sum;
    hasAmount = true;
    return sum + amount;
  }, 0);

  return hasAmount ? total : undefined;
};

const extractAmount = (payload) => {
  const candidates = [
    payload?.amount,
    payload?.balance,
    payload?.saldo,
    payload?.totalAdminFee,
    payload?.total_admin_fee,
    payload?.adminFeeTotal,
    payload?.admin_fee_total,
    payload?.admin_fee,
    payload?.adminFee,
    payload?.fee,
    payload?.price,
    payload?.data?.amount,
    payload?.data?.balance,
    payload?.data?.saldo,
    payload?.data?.totalAdminFee,
    payload?.data?.total_admin_fee,
    payload?.data?.adminFeeTotal,
    payload?.data?.admin_fee_total,
    payload?.data?.admin_fee,
    payload?.data?.adminFee,
    payload?.data?.fee,
    payload?.data?.price,
    payload?.data?.payment_config?.admin_fee,
    payload?.data?.paymentConfig?.adminFee,
    payload?.result?.amount,
    payload?.result?.balance,
    payload?.result?.saldo,
    payload?.result?.totalAdminFee,
    payload?.result?.total_admin_fee,
    payload?.result?.adminFeeTotal,
    payload?.result?.admin_fee_total,
    payload?.result?.admin_fee,
    payload?.result?.adminFee,
    payload?.result?.fee,
    payload?.result?.price,
    payload?.summary?.totalAdminFee,
    payload?.summary?.total_admin_fee,
    payload?.summary?.adminFee,
    payload?.summary?.admin_fee,
    payload?.total,
    payload?.data?.total,
    payload?.result?.total,
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

const extractBalanceAmount = (sourceId, payload) => {
  if (sourceId === 'simpaskor') {
    return extractAdminFeeAmount(payload) ?? extractDetailsAdminFeeTotal(payload) ?? extractAmount(payload);
  }

  return extractAmount(payload);
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

const resolveSimpaskorUrl = (url) => {
  if (!url) {
    return '';
  }

  return new URL(url, process.env.SIMPASKOR_API_BASE_URL ?? 'https://simpaskor.id').toString();
};

const isPaymentConfigUrl = (url) => {
  try {
    return /\/payment-config\/?$/.test(new URL(resolveSimpaskorUrl(url)).pathname);
  } catch {
    return false;
  }
};

const buildSimpaskorUrl = (baseUrl) => {
  if (!baseUrl) return '';
  const url = new URL(resolveSimpaskorUrl(baseUrl));
  if (process.env.SIMPASKOR_BALANCE_FROM) {
    url.searchParams.set('from', process.env.SIMPASKOR_BALANCE_FROM);
  }
  if (process.env.SIMPASKOR_BALANCE_TO) {
    url.searchParams.set('to', process.env.SIMPASKOR_BALANCE_TO);
  }
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
    where: excludeSyncSnapshots,
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
  const data = {
    status: dbStatus,
    ...(dbStatus === 'sinkron' ? { currentBalance: amount, lastSyncedAt: new Date() } : {}),
  };

  await prisma.revenueSource.update({
    where: { id },
    data,
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

const getCurrentSourceAmount = async (id) => {
  const source = await prisma.revenueSource.findUnique({
    where: { id },
    select: { currentBalance: true },
  });

  return Number(source?.currentBalance ?? 0);
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

const normalizeAdminFeeSource = (value) => {
  const source = String(value ?? '').trim();
  return source ? source.toLowerCase().slice(0, 40) : null;
};

const extractAdminFeeOrderId = (payload) => {
  const orderId = firstPresent(
    payload?.orderId,
    payload?.order_id,
    payload?.midtransOrderId,
    payload?.midtrans_order_id,
    payload?.transactionId,
    payload?.transaction_id,
    payload?.paymentId,
    payload?.payment_id,
    payload?.invoiceId,
    payload?.invoice_id,
    payload?.id,
  );
  return String(orderId ?? '').trim();
};

const extractAdminFeeRowAmount = (payload) =>
  firstFiniteAmount(
    payload?.adminFee,
    payload?.admin_fee,
    payload?.adminFeeAmount,
    payload?.admin_fee_amount,
    payload?.fee,
    payload?.amount,
    payload?.totalAdminFee,
    payload?.total_admin_fee,
  );

const inferAdminFeeSource = (payload, fallbackSource = null) => {
  const explicit = normalizeAdminFeeSource(firstPresent(payload?.source, payload?.type, payload?.kind, payload?.category));
  if (explicit) return explicit;

  const orderId = extractAdminFeeOrderId(payload).toLowerCase();
  const description = String(payload?.description ?? '').toLowerCase();
  const text = `${orderId} ${description}`;

  if (text.includes('vote') || text.includes('voting')) return 'voting';
  if (text.includes('ticket') || text.includes('tiket')) return 'ticket';
  if (text.includes('registration') || text.includes('registrasi') || text.includes('pendaftaran')) return 'registration';
  if (text.includes('kta')) return 'kta';

  return normalizeAdminFeeSource(fallbackSource);
};

const extractAdminFeeRows = (payload) => {
  const groupRoots = [payload?.details, payload?.data?.details, payload?.result?.details].filter(Boolean);
  const groupedRows = groupRoots.flatMap((details) => [
    ...(Array.isArray(details?.tickets) ? details.tickets.map((row) => ({ row, source: 'ticket' })) : []),
    ...(Array.isArray(details?.voting) ? details.voting.map((row) => ({ row, source: 'voting' })) : []),
    ...(Array.isArray(details?.registrations) ? details.registrations.map((row) => ({ row, source: 'registration' })) : []),
    ...(Array.isArray(details?.kta) ? details.kta.map((row) => ({ row, source: 'kta' })) : []),
  ]);

  if (groupedRows.length > 0) {
    return groupedRows;
  }

  const rows = [
    payload?.items,
    payload?.transactions,
    payload?.data?.items,
    payload?.data?.transactions,
    payload?.result?.items,
    payload?.result?.transactions,
  ].find(Array.isArray);

  if (rows) {
    return rows.map((row) => ({ row, source: null }));
  }

  return [{ row: payload, source: null }];
};

const normalizeAdminFeeEntries = (payload) =>
  extractAdminFeeRows(payload)
    .map(({ row, source }) => {
      const orderId = extractAdminFeeOrderId(row);
      const amount = extractAdminFeeRowAmount(row);
      return {
        row,
        orderId,
        amount,
        paidAt: extractOccurredAt(row),
        description: extractDescription('Simpaskor', row),
        source: inferAdminFeeSource(row, source),
      };
    })
    .filter((entry) => entry.orderId && Number.isFinite(entry.amount) && entry.amount > 0);

const syncSimpaskorAdminFeeBalance = async () => {
  const amount = await totalIncomeBySource('simpaskor');
  await prisma.revenueSource.update({
    where: { id: 'simpaskor' },
    data: {
      currentBalance: amount,
      status: amount > 0 ? 'sinkron' : 'api_belum_terhubung',
      lastSyncedAt: amount > 0 ? new Date() : undefined,
    },
  });
  return amount;
};

const applySimpaskorAdminFees = async (payload, { writeLog = true } = {}) => {
  const entries = normalizeAdminFeeEntries(payload);

  if (entries.length === 0) {
    if (writeLog) {
      await prisma.apiSyncLog.create({
        data: {
          sourceId: 'simpaskor',
          status: 'failed',
          message: 'Webhook Simpaskor diterima tanpa order_id dan nominal admin fee valid.',
          responsePayload: payload,
        },
      });
    }
    return { inserted: 0, total: 0, currentTotal: await getCurrentSourceAmount('simpaskor') };
  }

  let total = 0;
  for (const entry of entries) {
    total += entry.amount;
    await prisma.adminFee.upsert({
      where: { orderId: entry.orderId },
      create: {
        orderId: entry.orderId,
        amount: entry.amount,
        paidAt: entry.paidAt,
        description: entry.description,
        source: entry.source,
        rawPayload: entry.row,
      },
      update: {
        amount: entry.amount,
        paidAt: entry.paidAt,
        description: entry.description,
        source: entry.source,
        rawPayload: entry.row,
      },
    });

    await prisma.financeTransaction.upsert({
      where: { unique_source_external_id: { sourceId: 'simpaskor', externalId: entry.orderId } },
      create: {
        sourceId: 'simpaskor',
        externalId: entry.orderId,
        direction: 'income',
        amount: entry.amount,
        description: entry.description,
        status: 'terverifikasi',
        occurredAt: entry.paidAt,
        rawPayload: entry.row,
      },
      update: {
        amount: entry.amount,
        description: entry.description,
        status: 'terverifikasi',
        occurredAt: entry.paidAt,
        rawPayload: entry.row,
      },
    });
  }

  const currentTotal = await syncSimpaskorAdminFeeBalance();

  if (writeLog) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId: 'simpaskor',
        status: 'success',
        message: `Admin fee Simpaskor menyimpan ${entries.length} transaksi.`,
        responsePayload: payload,
      },
    });
  }

  return { inserted: entries.length, total, currentTotal };
};

const getAdminFeeDateFilter = (searchParams) => {
  const where = {};
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const source = normalizeAdminFeeSource(searchParams.get('source'));

  if (source) {
    where.source = source;
  }

  if (from || to) {
    where.paidAt = {};
    if (from) where.paidAt.gte = normalizeDate(from);
    if (to) {
      const toDate = normalizeDate(to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        toDate.setHours(23, 59, 59, 999);
      }
      where.paidAt.lte = toDate;
    }
  }

  return where;
};

const listSimpaskorAdminFees = async (searchParams = new URLSearchParams()) => {
  const where = getAdminFeeDateFilter(searchParams);
  const [rows, aggregate] = await Promise.all([
    prisma.adminFee.findMany({
      where,
      orderBy: { paidAt: 'desc' },
    }),
    prisma.adminFee.aggregate({
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const items = rows.map((row) => ({
    id: String(row.id),
    type: row.source ?? 'admin_fee',
    title: row.description,
    subtitle: row.source ?? '',
    quantity: 1,
    adminFee: Number(row.amount),
    paidAt: row.paidAt,
    orderId: row.orderId,
  }));

  return {
    sourceId: 'simpaskor',
    items,
    total: Number(aggregate._sum.amount ?? 0),
    count: aggregate._count.id,
  };
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
    where: { sourceId, direction: 'income' },
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
      amount: await getCurrentSourceAmount(id),
      status: 'API Belum Terhubung',
      message: `URL API ${name} belum diatur di .env.local.`,
    };
    await updateSourceSync({ ...result, payload: {} });
    return result;
  }

  if (id === 'simpaskor' && isPaymentConfigUrl(url)) {
    const result = {
      id,
      amount: await getCurrentSourceAmount(id),
      status: 'API Belum Terhubung',
      message: 'SIMPASKOR_BALANCE_URL masih mengarah ke payment-config. Gunakan endpoint saldo/admin-fees Simpaskor.',
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
        amount: await getCurrentSourceAmount(id),
        status: 'API Belum Terhubung',
        message: `API ${name} mengembalikan status ${response.status}.`,
      };
      await updateSourceSync({ ...result, payload });
      return result;
    }

    const syncedAdminFees = id === 'simpaskor'
      ? await applySimpaskorAdminFees(payload, { writeLog: false })
      : null;
    const amount = id === 'simpaskor'
      ? syncedAdminFees?.currentTotal ?? await totalIncomeBySource(id)
      : extractBalanceAmount(id, payload);

    const result = {
      id,
      amount,
      status: 'Sinkron',
      lastSync: new Date().toISOString(),
      message: `Saldo ${name} berhasil disinkronkan dari API.`,
    };
    await updateSourceSync({ ...result, payload });
    if (id !== 'simpaskor') {
      await createSyncTransaction(id, name, result.amount);
    }
    return result;
  } catch (error) {
    const result = {
      id,
      amount: await getCurrentSourceAmount(id),
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

    const apiKeySourceId = sourceId === 'simpaskor' ? 'simpaskor-admin-fee' : sourceId;
    if (!verifyExternalApiKey(request, apiKeySourceId)) {
      json(response, 401, { message: `API key webhook ${sourceId} tidak valid.` });
      return;
    }

    try {
      const payload = await parseBody(request);
      const result = sourceId === 'simpaskor'
        ? await applySimpaskorAdminFees(payload)
        : await applyWebhookTransactions(sourceId, payload);
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

  if (request.method === 'GET' && request.url === '/api/admin/access') {
    if (!canUse(user, 'accounts.manage') && !canUse(user, 'revenue_shares.manage')) {
      json(response, 403, { message: 'Akun ini tidak memiliki akses manajemen.' });
      return;
    }

    json(response, 200, await listManagedUsers());
    return;
  }

  if (request.method === 'POST' && request.url === '/api/admin/accounts') {
    if (!requirePermission(user, response, 'accounts.manage')) return;
    const result = await createManagedUser(request);
    json(response, result.statusCode, result.payload);
    return;
  }

  if (request.method === 'POST' && /^\/api\/admin\/accounts\/\d+$/.test(request.url)) {
    if (!canUse(user, 'accounts.manage') && !canUse(user, 'revenue_shares.manage')) {
      json(response, 403, { message: 'Akun ini tidak memiliki akses manajemen.' });
      return;
    }

    const userId = BigInt(request.url.split('/')[4]);
    const result = await updateManagedUser(request, userId);
    json(response, result.statusCode, result.payload);
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/sources') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    await syncSimpaskorAdminFeeBalance();
    json(response, 200, { sources: await getSourcesFromDb() });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/finance/sync') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    await syncApiSources();
    json(response, 200, {
      sources: await getSourcesFromDb(),
      transactions: await getTransactionsFromDb(),
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/transactions') {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    json(response, 200, { transactions: await getTransactionsFromDb() });
    return;
  }

  const currentUrl = new URL(request.url, localApiBaseUrl);

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/admin-fees') {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    json(response, 200, await listSimpaskorAdminFees(currentUrl.searchParams));
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/simpaskor/balance') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
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
    if (!requirePermission(user, response, 'finance.dashboard')) return;
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
    if (!requirePermission(user, response, 'finance.transactions')) return;
    const sourceId = request.url.split('/')[4];

    if (sourceId === 'simpaskor') {
      json(response, 200, await listSimpaskorAdminFees());
      return;
    }

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
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    await syncSimpaskorAdminFeeBalance();
    const [sources, transactions] = await Promise.all([
      getSourcesFromDb(),
      getTransactionsFromDb(),
    ]);
    const totalIncome = sources.reduce((sum, s) => sum + s.amount, 0);
    const apiIncome = sources.filter((s) => s.category === 'api').reduce((sum, s) => sum + s.amount, 0);
    const revenueSharePercent = Number(user.revenueShare?.percentage ?? 0);
    json(response, 200, {
      sources,
      transactions,
      summary: {
        totalIncome,
        apiIncome,
        revenueSharePercent,
        revenueShareAmount: Math.round(totalIncome * revenueSharePercent / 100),
      },
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

await ensureAccessSchema();
await ensureAdminFeeSchema();
await ensureRevenueSources();
await syncSimpaskorAdminFeeBalance();
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
