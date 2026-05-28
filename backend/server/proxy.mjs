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
  { id: 'source.simpaskor', label: 'Sumber Simpaskor', feature: 'sources' },
  { id: 'source.forbasi', label: 'Sumber Forbasi', feature: 'sources' },
  { id: 'source.manual', label: 'Sumber Manual (Desa, Sekolah, Swasta)', feature: 'sources' },
];

const sourcePermissionMap = {
  'source.simpaskor': ['simpaskor'],
  'source.forbasi': ['forbasi'],
  'source.manual': ['desa', 'sekolah', 'swasta'],
};
const sourcePermissionIds = Object.keys(sourcePermissionMap);

const allPermissionIds = permissionCatalog.map((permission) => permission.id);
const defaultAccountPermissions = ['finance.dashboard', 'source.simpaskor', 'source.forbasi', 'source.manual'];
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

const getAllowedSourceIds = (user) => {
  if (isSuperAdmin(user)) return null;
  const perms = new Set(getPermissionIds(user));
  const allowed = new Set();
  for (const [perm, ids] of Object.entries(sourcePermissionMap)) {
    if (perms.has(perm)) ids.forEach((id) => allowed.add(id));
  }
  return [...allowed];
};

const filterSources = (sources, allowedIds) => (allowedIds === null ? sources : sources.filter((s) => allowedIds.includes(s.id)));
const filterTransactions = (transactions, allowedIds) => (allowedIds === null ? transactions : transactions.filter((tx) => allowedIds.includes(tx.sourceId)));

const hasSourceAccess = (user, sourceId) => {
  const allowed = getAllowedSourceIds(user);
  return allowed === null || allowed.includes(sourceId);
};

const requireSourceAccess = (user, response, sourceId) => {
  if (hasSourceAccess(user, sourceId)) return true;
  json(response, 403, { message: 'Akun ini tidak memiliki akses ke sumber pendapatan tersebut.' });
  return false;
};

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

const excludeSyncSnapshots = {
  NOT: { externalId: { startsWith: 'sync-' } },
};

const transactionListFilter = {
  NOT: [
    { externalId: { startsWith: 'sync-' } },
    { externalId: { startsWith: 'ps-' } },
    { externalId: { startsWith: 'pp-' } },
  ],
};

const totalVerifiedIncome = async () => {
  const result = await prisma.revenueSource.aggregate({
    _sum: { currentBalance: true },
  });
  return Number(result._sum.currentBalance ?? 0);
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

const ensurePlatformRevenueSchema = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS platform_revenue (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      external_id VARCHAR(160) NOT NULL UNIQUE,
      kind VARCHAR(32) NOT NULL,
      sub_type VARCHAR(40) NULL,
      event_id VARCHAR(120) NULL,
      event_title VARCHAR(255) NULL,
      amount DECIMAL(18, 2) NOT NULL,
      gross_amount DECIMAL(18, 2) NULL,
      share_percent DECIMAL(5, 2) NULL,
      paid_at DATETIME NOT NULL,
      description VARCHAR(255) NOT NULL,
      order_id VARCHAR(120) NULL,
      raw_payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY index_platform_revenue_kind_paid_at (kind, paid_at),
      KEY index_platform_revenue_paid_at (paid_at)
    )
  `);

  if (!(await columnExists('platform_revenue', 'gross_amount'))) {
    await prisma.$executeRawUnsafe('ALTER TABLE platform_revenue ADD COLUMN gross_amount DECIMAL(18, 2) NULL AFTER amount');
  }
  if (!(await columnExists('platform_revenue', 'share_percent'))) {
    await prisma.$executeRawUnsafe('ALTER TABLE platform_revenue ADD COLUMN share_percent DECIMAL(5, 2) NULL AFTER gross_amount');
  }
};

const ensureSimpaskorMetricsSchema = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS simpaskor_metrics (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      metric_key VARCHAR(80) NOT NULL UNIQUE,
      numeric_value DECIMAL(18, 2) NOT NULL DEFAULT 0,
      json_value JSON NULL,
      fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

const backfillSourcePermissions = async () => {
  const accounts = await prisma.adminUser.findMany({
    where: { role: { notIn: [...superAdminRoles] } },
    include: { permissions: true },
  });
  const data = [];
  for (const account of accounts) {
    const existing = new Set(account.permissions.map((p) => p.permission));
    const hasAnySourcePerm = sourcePermissionIds.some((id) => existing.has(id));
    if (hasAnySourcePerm) continue;
    for (const permission of sourcePermissionIds) {
      data.push({ userId: account.id, permission, canUse: true });
    }
  }
  if (data.length) {
    await prisma.accountPermission.createMany({ data, skipDuplicates: true });
    console.log(`[Vertinova API] Backfilled source permissions for ${data.length / sourcePermissionIds.length} account(s).`);
  }
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
  const [rows, simpaskorBreakdown] = await Promise.all([
    prisma.revenueSource.findMany(),
    getSimpaskorBreakdown(),
  ]);
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
      breakdown: row.id === 'simpaskor' ? simpaskorBreakdown : null,
    }));
};

const getTransactionsFromDb = async () => {
  const rows = await prisma.financeTransaction.findMany({
    where: transactionListFilter,
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

const computeSimpaskorBalanceFromDb = async () => {
  const result = await prisma.financeTransaction.aggregate({
    where: {
      sourceId: 'simpaskor',
      direction: 'income',
      NOT: [
        { externalId: { startsWith: 'sync-' } },
        { externalId: { startsWith: 'pp-' } },
      ],
    },
    _sum: { amount: true },
  });
  return Number(result._sum.amount ?? 0);
};

const syncSimpaskorAdminFeeBalance = async () => {
  const summaryMetric = await readSimpaskorMetric('summary');
  const summary = summaryMetric?.jsonValue ?? null;
  const summaryAmount = summary
    ? Number(summary?.adminFee?.total ?? 0) + Number(summary?.platformShare?.total ?? 0)
    : 0;
  const amount = summaryAmount > 0 ? summaryAmount : await computeSimpaskorBalanceFromDb();
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
    kind: 'admin_fee',
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

const platformShareTypeLabel = (subType) => {
  const normalized = String(subType ?? '').toLowerCase();
  if (normalized === 'ticket' || normalized === 'ticketing' || normalized === 'tiket') return 'Bagi Hasil Tiket';
  if (normalized === 'voting' || normalized === 'vote') return 'Bagi Hasil Voting';
  return 'Bagi Hasil';
};

const packagePaymentTypeLabel = (subType) => {
  const tier = String(subType ?? '').toUpperCase();
  return tier ? `Paket ${tier}` : 'Paket Event';
};

const extractPlatformShareRows = (payload) => {
  const detailRoots = [payload?.details, payload?.data?.details, payload?.result?.details].filter(Boolean);
  const shareCandidates = detailRoots.flatMap((details) => [
    ...(Array.isArray(details?.revenueShares) ? details.revenueShares : []),
    ...(Array.isArray(details?.shares) ? details.shares : []),
    ...(Array.isArray(details?.ticketShares) ? details.ticketShares.map((row) => ({ ...row, kindHint: 'ticket' })) : []),
    ...(Array.isArray(details?.votingShares) ? details.votingShares.map((row) => ({ ...row, kindHint: 'voting' })) : []),
  ]);
  return shareCandidates;
};

const extractPackagePaymentRows = (payload) => {
  const detailRoots = [payload?.details, payload?.data?.details, payload?.result?.details].filter(Boolean);
  return detailRoots.flatMap((details) => [
    ...(Array.isArray(details?.packagePayments) ? details.packagePayments : []),
    ...(Array.isArray(details?.eventPayments) ? details.eventPayments : []),
    ...(Array.isArray(details?.packages) ? details.packages : []),
  ]);
};

const inferPlatformShareSubType = (row) => {
  const explicit = firstPresent(row?.kindHint, row?.kind, row?.type, row?.category, row?.share_type, row?.shareType);
  const normalized = String(explicit ?? '').toLowerCase();
  if (normalized.includes('vote') || normalized.includes('voting')) return 'voting';
  if (normalized.includes('ticket') || normalized.includes('tiket')) return 'ticket';
  const orderId = String(firstPresent(row?.midtransOrderId, row?.orderId, row?.order_id, row?.id) ?? '').toLowerCase();
  if (orderId.includes('vote') || orderId.includes('voting')) return 'voting';
  if (orderId.includes('ticket') || orderId.includes('tiket')) return 'ticket';
  return normalized || null;
};

const extractPlatformShareAmount = (row) =>
  firstFiniteAmount(
    row?.platformAmount,
    row?.platform_amount,
    row?.platformShare,
    row?.platform_share,
    row?.amount,
  );

const extractGrossAmount = (row) =>
  firstFiniteAmount(
    row?.grossAmount,
    row?.gross_amount,
    row?.totalAmount,
    row?.total_amount,
    row?.grossRevenue,
    row?.gross_revenue,
  );

const extractSharePercent = (row) => {
  const value = firstFiniteAmount(
    row?.platformSharePercent,
    row?.platform_share_percent,
    row?.sharePercent,
    row?.share_percent,
    row?.platformPercentage,
    row?.platform_percentage,
  );
  if (!Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped * 100) / 100;
};

const extractPackagePaymentAmount = (row) =>
  firstFiniteAmount(
    row?.amount,
    row?.price,
    row?.total,
    row?.packageAmount,
    row?.package_amount,
  );

const extractEventId = (row) => {
  const value = firstPresent(row?.eventId, row?.event_id, row?.event?.id);
  return value !== undefined ? String(value) : null;
};

const extractEventTitle = (row) => {
  const value = firstPresent(row?.eventTitle, row?.event_title, row?.event?.title, row?.title, row?.name);
  return value !== undefined ? String(value).slice(0, 255) : null;
};

const extractOrderId = (row) => {
  const value = firstPresent(row?.midtransOrderId, row?.midtrans_order_id, row?.orderId, row?.order_id);
  return value !== undefined ? String(value).slice(0, 120) : null;
};

const inferPlatformRevenueStatus = (row) => {
  const value = firstPresent(row?.status, row?.state, row?.disbursementStatus);
  return value !== undefined ? String(value).toUpperCase() : null;
};

const buildPlatformRevenueEntry = ({ row, kind, idPrefix, amountFn, subTypeFn, descriptionFallback }) => {
  const status = inferPlatformRevenueStatus(row);
  if (status === 'CANCELLED') return null;

  const amount = amountFn(row);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const rawId = firstPresent(row?.id, row?.externalId, row?.external_id, row?.midtransOrderId, row?.orderId);
  if (rawId === undefined) return null;

  const subType = subTypeFn(row);
  const eventId = extractEventId(row);
  const eventTitle = extractEventTitle(row);
  const orderId = extractOrderId(row);

  let grossAmount = null;
  let sharePercent = null;
  if (kind === 'platform_share') {
    const gross = extractGrossAmount(row);
    grossAmount = Number.isFinite(gross) ? gross : null;
    sharePercent = extractSharePercent(row);
    if (sharePercent == null && grossAmount && grossAmount > 0) {
      sharePercent = Math.round((amount / grossAmount) * 10000) / 100;
    }
  }

  return {
    row,
    kind,
    subType,
    eventId,
    eventTitle,
    amount,
    grossAmount,
    sharePercent,
    paidAt: extractOccurredAt(row),
    description: extractDescription(descriptionFallback, row),
    orderId,
    externalId: `${idPrefix}${String(rawId)}`,
  };
};

const normalizePlatformRevenueEntries = (payload) => {
  const shareRows = extractPlatformShareRows(payload);
  const packageRows = extractPackagePaymentRows(payload);

  const shareEntries = shareRows
    .map((row) =>
      buildPlatformRevenueEntry({
        row,
        kind: 'platform_share',
        idPrefix: 'ps-',
        amountFn: extractPlatformShareAmount,
        subTypeFn: inferPlatformShareSubType,
        descriptionFallback: 'Bagi hasil Simpaskor',
      }),
    )
    .filter(Boolean);

  const packageEntries = packageRows
    .map((row) =>
      buildPlatformRevenueEntry({
        row,
        kind: 'package_payment',
        idPrefix: 'pp-',
        amountFn: extractPackagePaymentAmount,
        subTypeFn: (r) => {
          const tier = firstPresent(r?.tier, r?.packageTier, r?.package_tier, r?.package, r?.kind, r?.type);
          return tier !== undefined ? String(tier).toUpperCase() : null;
        },
        descriptionFallback: 'Pembayaran paket Simpaskor',
      }),
    )
    .filter(Boolean);

  return [...shareEntries, ...packageEntries];
};

const applySimpaskorPlatformRevenue = async (payload, { writeLog = true } = {}) => {
  const entries = normalizePlatformRevenueEntries(payload);

  if (entries.length === 0) {
    if (writeLog) {
      await prisma.apiSyncLog.create({
        data: {
          sourceId: 'simpaskor',
          status: 'failed',
          message: 'Platform revenue Simpaskor diterima tanpa baris valid.',
          responsePayload: payload,
        },
      });
    }
    return { inserted: 0, total: 0 };
  }

  let total = 0;
  for (const entry of entries) {
    total += entry.amount;

    await prisma.platformRevenue.upsert({
      where: { externalId: entry.externalId },
      create: {
        externalId: entry.externalId,
        kind: entry.kind,
        subType: entry.subType,
        eventId: entry.eventId,
        eventTitle: entry.eventTitle,
        amount: entry.amount,
        grossAmount: entry.grossAmount,
        sharePercent: entry.sharePercent,
        paidAt: entry.paidAt,
        description: entry.description,
        orderId: entry.orderId,
        rawPayload: entry.row,
      },
      update: {
        kind: entry.kind,
        subType: entry.subType,
        eventId: entry.eventId,
        eventTitle: entry.eventTitle,
        amount: entry.amount,
        grossAmount: entry.grossAmount,
        sharePercent: entry.sharePercent,
        paidAt: entry.paidAt,
        description: entry.description,
        orderId: entry.orderId,
        rawPayload: entry.row,
      },
    });

    await prisma.financeTransaction.upsert({
      where: { unique_source_external_id: { sourceId: 'simpaskor', externalId: entry.externalId } },
      create: {
        sourceId: 'simpaskor',
        externalId: entry.externalId,
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

  if (writeLog) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId: 'simpaskor',
        status: 'success',
        message: `Platform revenue Simpaskor menyimpan ${entries.length} transaksi.`,
        responsePayload: payload,
      },
    });
  }

  return { inserted: entries.length, total };
};

const listSimpaskorPlatformRevenue = async (searchParams = new URLSearchParams()) => {
  const where = {};
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const kind = searchParams.get('kind');

  if (kind === 'platform_share' || kind === 'package_payment') {
    where.kind = kind;
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

  const [rows, aggregate, byKind] = await Promise.all([
    prisma.platformRevenue.findMany({ where, orderBy: { paidAt: 'desc' } }),
    prisma.platformRevenue.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
    prisma.platformRevenue.groupBy({
      by: ['kind'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const items = rows.map((row) => {
    const sharePercent = row.sharePercent !== null && row.sharePercent !== undefined
      ? Number(row.sharePercent)
      : null;
    const grossAmount = row.grossAmount !== null && row.grossAmount !== undefined
      ? Number(row.grossAmount)
      : null;
    const subtitle = row.kind === 'platform_share'
      ? [
          row.subType ? `Tipe: ${row.subType}` : null,
          sharePercent !== null ? `${sharePercent.toFixed(2)}% dari bruto` : null,
        ].filter(Boolean).join(' • ')
      : (row.subType ? `Tier: ${row.subType}` : '');

    return {
      id: row.externalId,
      kind: row.kind,
      type: row.kind === 'platform_share'
        ? platformShareTypeLabel(row.subType)
        : packagePaymentTypeLabel(row.subType),
      title: row.eventTitle ?? row.description,
      subtitle,
      quantity: 1,
      adminFee: Number(row.amount),
      grossAmount,
      sharePercent,
      paidAt: row.paidAt,
      orderId: row.orderId ?? '',
    };
  });

  const breakdown = byKind.reduce((acc, row) => {
    acc[row.kind] = { total: Number(row._sum.amount ?? 0), count: row._count.id };
    return acc;
  }, { platform_share: { total: 0, count: 0 }, package_payment: { total: 0, count: 0 } });

  return {
    sourceId: 'simpaskor',
    items,
    total: Number(aggregate._sum.amount ?? 0),
    count: aggregate._count.id,
    breakdown,
  };
};

const buildSimpaskorEndpointUrl = (rawValue, defaultPath) => {
  const raw = rawValue ?? defaultPath;
  if (!raw) return '';
  const url = new URL(resolveSimpaskorUrl(raw));
  return url.toString();
};

const fetchSimpaskorEndpoint = async (url) => {
  if (!url) {
    return { ok: false, status: 0, payload: {}, message: 'URL Simpaskor belum diatur.' };
  }

  const apiKey = process.env.SIMPASKOR_API_KEY ?? '';
  const headerName = process.env.SIMPASKOR_API_KEY_HEADER ?? 'X-API-Key';
  const headers = { Accept: 'application/json' };
  if (apiKey) headers[headerName] = apiKey;

  try {
    const response = await fetchWithRetry(url, { headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, status: response.status, payload, message: `Status ${response.status}.` };
    }
    return { ok: true, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: {},
      message: error instanceof Error ? error.message : 'Gagal menghubungi API Simpaskor.',
    };
  }
};

const upsertSimpaskorMetric = async (metricKey, numericValue, jsonValue) =>
  prisma.simpaskorMetric.upsert({
    where: { metricKey },
    create: {
      metricKey,
      numericValue: Number.isFinite(numericValue) ? numericValue : 0,
      jsonValue,
      fetchedAt: new Date(),
    },
    update: {
      numericValue: Number.isFinite(numericValue) ? numericValue : 0,
      jsonValue,
      fetchedAt: new Date(),
    },
  });

const extractSummaryFromPayload = (payload) => {
  const summary = payload?.summary ?? payload?.data?.summary ?? payload?.result?.summary ?? payload?.data ?? payload?.result ?? payload ?? {};
  const adminFee = summary?.adminFee ?? summary?.admin_fee ?? {};
  const platformShare = summary?.platformShare ?? summary?.platform_share ?? {};
  const packagePayments = summary?.packagePayments ?? summary?.package_payments ?? {};
  const numeric = (value) => {
    const amount = normalizeAmount(value);
    return Number.isFinite(amount) ? amount : 0;
  };
  const totalAdminFee = typeof adminFee === 'object'
    ? firstPresent(adminFee.total, adminFee.totalAdminFee, adminFee.total_admin_fee)
    : adminFee;
  const tierBreakdown = packagePayments?.byTier ?? packagePayments?.by_tier;
  return {
    currency: payload?.currency ?? 'IDR',
    totalSimpaskorBalance: numeric(firstPresent(
      summary?.totalSimpaskorBalance,
      summary?.total_simpaskor_balance,
      summary?.balance,
      summary?.saldo,
      summary?.total,
    )),
    adminFee: {
      total: numeric(totalAdminFee),
      ticket: numeric(adminFee.ticket ?? adminFee.tickets),
      voting: numeric(adminFee.voting ?? adminFee.vote),
      registration: numeric(adminFee.registration ?? adminFee.registrations),
      qrisFee: numeric(adminFee.qrisFee ?? adminFee.qris_fee ?? summary?.qrisFee ?? summary?.qris_fee),
    },
    platformShare: {
      total: numeric(platformShare.total ?? platformShare.platformShare ?? platformShare.platform_share),
      fromTickets: numeric(platformShare.fromTickets ?? platformShare.from_tickets),
      fromVoting: numeric(platformShare.fromVoting ?? platformShare.from_voting),
      ticketGrossRevenue: numeric(platformShare.ticketGrossRevenue ?? platformShare.ticket_gross_revenue),
      votingGrossRevenue: numeric(platformShare.votingGrossRevenue ?? platformShare.voting_gross_revenue),
    },
    packagePayments: {
      total: numeric(packagePayments.total ?? packagePayments.packagePayments ?? packagePayments.package_payments),
      byTier: tierBreakdown && typeof tierBreakdown === 'object'
        ? Object.fromEntries(
            Object.entries(tierBreakdown).map(([tier, value]) => [tier, numeric(value)]),
          )
        : {},
    },
  };
};

const extractRevenueShareBalancesFromPayload = (payload) => {
  const summary = payload?.summary ?? {};
  const numeric = (value) => {
    const amount = normalizeAmount(value);
    return Number.isFinite(amount) ? amount : 0;
  };
  return {
    currency: payload?.currency ?? 'IDR',
    scope: payload?.filters?.scope ?? 'lifetime',
    summary: {
      grossRevenue: numeric(summary.grossRevenue),
      ticketGrossRevenue: numeric(summary.ticketGrossRevenue),
      votingGrossRevenue: numeric(summary.votingGrossRevenue),
      platformShare: numeric(summary.platformShare),
      panitiaShare: numeric(summary.panitiaShare),
      ticketRevenue: numeric(summary.ticketRevenue),
      votingRevenue: numeric(summary.votingRevenue),
      totalWithdrawn: numeric(summary.totalWithdrawn),
      totalPending: numeric(summary.totalPending),
      activeBalance: numeric(summary.activeBalance),
      lockedPlatformShare: numeric(summary.lockedPlatformShare),
      activePlatformShare: numeric(summary.activePlatformShare),
    },
    counts: {
      events: Number(payload?.counts?.events ?? 0),
      revenueShares: Number(payload?.counts?.revenueShares ?? 0),
    },
    events: Array.isArray(payload?.events) ? payload.events : [],
  };
};

const syncSimpaskorSummary = async () => {
  const url = buildSimpaskorEndpointUrl(process.env.SIMPASKOR_SUMMARY_URL, '/api/external/summary');
  const result = await fetchSimpaskorEndpoint(url);
  if (!result.ok) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId: 'simpaskor',
        status: 'failed',
        message: `Summary Simpaskor gagal: ${result.message ?? 'unknown'}.`,
        responsePayload: result.payload ?? {},
      },
    });
    return { ok: false, message: result.message, summary: null };
  }
  const summary = extractSummaryFromPayload(result.payload);
  await upsertSimpaskorMetric('summary', summary.totalSimpaskorBalance, summary);
  await upsertSimpaskorMetric('admin_fee_qris', summary.adminFee.qrisFee, null);
  await syncSimpaskorAdminFeeBalance();
  return { ok: true, summary };
};

const syncSimpaskorRevenueShareBalances = async () => {
  const url = buildSimpaskorEndpointUrl(
    process.env.SIMPASKOR_REVENUE_SHARE_BALANCES_URL,
    '/api/external/revenue-share-balances',
  );
  const result = await fetchSimpaskorEndpoint(url);
  if (!result.ok) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId: 'simpaskor',
        status: 'failed',
        message: `Revenue share balances Simpaskor gagal: ${result.message ?? 'unknown'}.`,
        responsePayload: result.payload ?? {},
      },
    });
    return { ok: false, message: result.message, balances: null };
  }
  const balances = extractRevenueShareBalancesFromPayload(result.payload);
  await upsertSimpaskorMetric('revenue_share_balances', balances.summary.activeBalance, balances);
  return { ok: true, balances };
};

const readSimpaskorMetric = async (metricKey) => {
  const row = await prisma.simpaskorMetric.findUnique({ where: { metricKey } });
  if (!row) return null;
  return {
    metricKey: row.metricKey,
    numericValue: Number(row.numericValue ?? 0),
    jsonValue: row.jsonValue ?? null,
    fetchedAt: row.fetchedAt,
  };
};

const getSimpaskorBreakdown = async () => {
  const [adminFeeAgg, platformAgg, shareAgg, summaryMetric, balancesMetric] = await Promise.all([
    prisma.adminFee.aggregate({ _sum: { amount: true } }),
    prisma.platformRevenue.groupBy({
      by: ['kind'],
      _sum: { amount: true, grossAmount: true },
      _count: { id: true },
    }),
    prisma.platformRevenue.aggregate({
      where: { kind: 'platform_share', sharePercent: { not: null } },
      _avg: { sharePercent: true },
      _min: { sharePercent: true },
      _max: { sharePercent: true },
    }),
    readSimpaskorMetric('summary'),
    readSimpaskorMetric('revenue_share_balances'),
  ]);

  const cachedSummary = summaryMetric?.jsonValue ?? null;
  const cachedBalances = balancesMetric?.jsonValue ?? null;
  const hasSummaryBreakdown = Number(cachedSummary?.totalSimpaskorBalance ?? 0) > 0;
  const summaryAdminFee = Number(cachedSummary?.adminFee?.total ?? 0);
  const summaryPlatformShare = Number(cachedSummary?.platformShare?.total ?? 0);
  const summaryPackagePayments = Number(cachedSummary?.packagePayments?.total ?? 0);
  const hasSummaryParts = hasSummaryBreakdown
    && (summaryAdminFee + summaryPlatformShare + summaryPackagePayments) > 0;
  const summaryPlatformGross = Number(cachedSummary?.platformShare?.ticketGrossRevenue ?? 0)
    + Number(cachedSummary?.platformShare?.votingGrossRevenue ?? 0);

  const adminFeeFromRows = Number(adminFeeAgg._sum.amount ?? 0);
  let platformShare = 0;
  let packagePayments = 0;
  let platformGross = 0;
  let platformShareCount = 0;
  let packageCount = 0;
  for (const row of platformAgg) {
    const value = Number(row._sum.amount ?? 0);
    if (row.kind === 'platform_share') {
      platformShare = value;
      platformGross = Number(row._sum.grossAmount ?? 0);
      platformShareCount = row._count.id;
    } else if (row.kind === 'package_payment') {
      packagePayments = value;
      packageCount = row._count.id;
    }
  }

  const adminFee = hasSummaryParts
    ? summaryAdminFee
    : adminFeeFromRows;
  platformShare = hasSummaryParts
    ? summaryPlatformShare
    : platformShare;
  packagePayments = hasSummaryParts
    ? summaryPackagePayments
    : packagePayments;
  platformGross = hasSummaryBreakdown && summaryPlatformGross > 0
    ? summaryPlatformGross
    : platformGross;

  const effectiveSharePercent = platformGross > 0
    ? Math.round((platformShare / platformGross) * 10000) / 100
    : null;
  const avgSharePercent = shareAgg._avg.sharePercent !== null && shareAgg._avg.sharePercent !== undefined
    ? Math.round(Number(shareAgg._avg.sharePercent) * 100) / 100
    : null;

  const bagiHasil = platformShare;
  const qrisFee = Number(cachedSummary?.adminFee?.qrisFee ?? 0);
  const total = adminFee + bagiHasil;

  return {
    adminFee,
    qrisFee,
    platformShare,
    packagePayments,
    bagiHasil,
    total,
    platformGross,
    sharePercent: {
      effective: effectiveSharePercent,
      average: avgSharePercent,
      min: shareAgg._min.sharePercent !== null && shareAgg._min.sharePercent !== undefined
        ? Number(shareAgg._min.sharePercent) : null,
      max: shareAgg._max.sharePercent !== null && shareAgg._max.sharePercent !== undefined
        ? Number(shareAgg._max.sharePercent) : null,
    },
    counts: {
      platformShare: platformShareCount,
      packagePayments: packageCount,
    },
    summary: cachedSummary
      ? { ...cachedSummary, fetchedAt: summaryMetric?.fetchedAt ?? null }
      : null,
    revenueShareBalances: cachedBalances
      ? { ...cachedBalances, fetchedAt: balancesMetric?.fetchedAt ?? null }
      : null,
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
    where: { sourceId, direction: 'income', ...excludeSyncSnapshots },
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

const buildSimpaskorPlatformRevenueUrl = () => {
  const raw = process.env.SIMPASKOR_PLATFORM_REVENUE_URL ?? '/api/external/platform-revenue?includeDetails=true';
  if (!raw) return '';
  const url = new URL(resolveSimpaskorUrl(raw));
  if (process.env.SIMPASKOR_BALANCE_FROM) url.searchParams.set('from', process.env.SIMPASKOR_BALANCE_FROM);
  if (process.env.SIMPASKOR_BALANCE_TO) url.searchParams.set('to', process.env.SIMPASKOR_BALANCE_TO);
  url.searchParams.set('includeDetails', 'true');
  return url.toString();
};

const syncSimpaskorPlatformRevenue = async () => {
  const url = buildSimpaskorPlatformRevenueUrl();
  if (!url) {
    return { ok: false, inserted: 0, total: 0, message: 'SIMPASKOR_PLATFORM_REVENUE_URL belum diatur.' };
  }

  const apiKey = process.env.SIMPASKOR_API_KEY ?? '';
  const headerName = process.env.SIMPASKOR_API_KEY_HEADER ?? 'X-API-Key';
  const headers = { Accept: 'application/json' };
  if (apiKey) headers[headerName] = apiKey;

  try {
    const response = await fetchWithRetry(url, { headers });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      await prisma.apiSyncLog.create({
        data: {
          sourceId: 'simpaskor',
          status: 'failed',
          message: `Platform revenue Simpaskor mengembalikan status ${response.status}.`,
          responsePayload: payload,
        },
      });
      return { ok: false, inserted: 0, total: 0, message: `Status ${response.status}.` };
    }

    const result = await applySimpaskorPlatformRevenue(payload, { writeLog: false });
    return { ok: true, ...result };
  } catch (error) {
    await prisma.apiSyncLog.create({
      data: {
        sourceId: 'simpaskor',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Gagal mengambil platform revenue Simpaskor.',
        responsePayload: {},
      },
    });
    return { ok: false, inserted: 0, total: 0, message: error instanceof Error ? error.message : 'Gagal mengambil platform revenue.' };
  }
};

const syncApiSources = async () => {
  const [simpaskor, forbasi] = await Promise.all([
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

  await syncSimpaskorPlatformRevenue();
  await syncSimpaskorSummary();
  await syncSimpaskorRevenueShareBalances();
  const finalSimpaskorAmount = await syncSimpaskorAdminFeeBalance();

  return [{ ...simpaskor, amount: finalSimpaskorAmount }, forbasi];
};

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

    await syncSimpaskorAdminFeeBalance();
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
    const allowed = getAllowedSourceIds(user);
    json(response, 200, { sources: filterSources(await getSourcesFromDb(), allowed) });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/finance/sync') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    await syncApiSources();
    const allowed = getAllowedSourceIds(user);
    json(response, 200, {
      sources: filterSources(await getSourcesFromDb(), allowed),
      transactions: filterTransactions(await getTransactionsFromDb(), allowed),
    });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/transactions') {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    const allowed = getAllowedSourceIds(user);
    json(response, 200, { transactions: filterTransactions(await getTransactionsFromDb(), allowed) });
    return;
  }

  const currentUrl = new URL(request.url, localApiBaseUrl);

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/admin-fees') {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    json(response, 200, await listSimpaskorAdminFees(currentUrl.searchParams));
    return;
  }

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/simpaskor/platform-revenue') {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    json(response, 200, await listSimpaskorPlatformRevenue(currentUrl.searchParams));
    return;
  }

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/simpaskor/breakdown') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    json(response, 200, { sourceId: 'simpaskor', breakdown: await getSimpaskorBreakdown() });
    return;
  }

  if (request.method === 'POST' && currentUrl.pathname === '/api/finance/simpaskor/sync-platform-revenue') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    const result = await syncSimpaskorPlatformRevenue();
    await syncSimpaskorAdminFeeBalance();
    json(response, result.ok ? 200 : 502, { sourceId: 'simpaskor', ...result });
    return;
  }

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/simpaskor/summary') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    const cached = await readSimpaskorMetric('summary');
    json(response, 200, {
      sourceId: 'simpaskor',
      summary: cached?.jsonValue ?? null,
      fetchedAt: cached?.fetchedAt ?? null,
    });
    return;
  }

  if (request.method === 'POST' && currentUrl.pathname === '/api/finance/simpaskor/sync-summary') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    const result = await syncSimpaskorSummary();
    json(response, result.ok ? 200 : 502, { sourceId: 'simpaskor', ...result });
    return;
  }

  if (request.method === 'GET' && currentUrl.pathname === '/api/finance/simpaskor/revenue-share-balances') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    const cached = await readSimpaskorMetric('revenue_share_balances');
    json(response, 200, {
      sourceId: 'simpaskor',
      balances: cached?.jsonValue ?? null,
      fetchedAt: cached?.fetchedAt ?? null,
    });
    return;
  }

  if (request.method === 'POST' && currentUrl.pathname === '/api/finance/simpaskor/sync-revenue-share-balances') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
    const result = await syncSimpaskorRevenueShareBalances();
    json(response, result.ok ? 200 : 502, { sourceId: 'simpaskor', ...result });
    return;
  }

  if (request.method === 'GET' && request.url === '/api/finance/simpaskor/balance') {
    if (!requirePermission(user, response, 'finance.dashboard')) return;
    if (!requireSourceAccess(user, response, 'simpaskor')) return;
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
    if (!requireSourceAccess(user, response, 'forbasi')) return;
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

  if (request.method === 'GET' && /^\/api\/finance\/details\/(simpaskor|forbasi)(\?|$)/.test(request.url)) {
    if (!requirePermission(user, response, 'finance.transactions')) return;
    const sourceId = currentUrl.pathname.split('/')[4];
    if (!requireSourceAccess(user, response, sourceId)) return;

    if (sourceId === 'simpaskor') {
      const [adminFees, platformRevenue, breakdown] = await Promise.all([
        listSimpaskorAdminFees(currentUrl.searchParams),
        listSimpaskorPlatformRevenue(currentUrl.searchParams),
        getSimpaskorBreakdown(),
      ]);
      const items = adminFees.items.slice().sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
      );
      json(response, 200, {
        sourceId: 'simpaskor',
        items,
        total: adminFees.total,
        count: items.length,
        breakdown,
        revenueShareSummary: {
          total: platformRevenue.total,
          count: platformRevenue.count,
          platformShare: platformRevenue.breakdown?.platform_share ?? { total: 0, count: 0 },
          packagePayments: platformRevenue.breakdown?.package_payment ?? { total: 0, count: 0 },
        },
      });
      return;
    }

    const base = process.env.FORBASI_BALANCE_URL;
    if (!base) { json(response, 503, { message: 'URL Forbasi belum diatur.' }); return; }
    const forbasiUrl = new URL(resolveApiUrl(base));
    forbasiUrl.searchParams.set('includeDetails', 'true');
    const apiKey = process.env.FORBASI_API_KEY ?? '';
    const apiKeyHeader = process.env.FORBASI_API_KEY_HEADER ?? 'X-API-Key';

    try {
      const headers = { Accept: 'application/json' };
      if (apiKey) headers[apiKeyHeader] = apiKey;
      const apiRes = await fetchWithRetry(forbasiUrl.toString(), { headers });
      const payload = await apiRes.json().catch(() => ({}));

      if (!apiRes.ok) {
        json(response, 502, { message: `API ${sourceId} mengembalikan status ${apiRes.status}.` });
        return;
      }

      const items = (payload?.details?.kta ?? []).map((r) => ({
        id: String(r.id), type: 'KTA', title: r.clubName ?? '-',
        subtitle: `${r.province ?? ''} — ${r.regency ?? ''}`.trim().replace(/^—|—$/, '').trim(),
        quantity: 1, adminFee: r.adminFee ?? 0, paidAt: r.paidAt, orderId: r.midtransOrderId,
      }));

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
    const [allSources, allTransactions] = await Promise.all([
      getSourcesFromDb(),
      getTransactionsFromDb(),
    ]);
    const allowed = getAllowedSourceIds(user);
    const sources = filterSources(allSources, allowed);
    const transactions = filterTransactions(allTransactions, allowed);
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
await ensurePlatformRevenueSchema();
await ensureSimpaskorMetricsSchema();
await ensureRevenueSources();
await prisma.financeTransaction.deleteMany({ where: { externalId: { startsWith: 'sync-' } } });
await syncSimpaskorAdminFeeBalance();
await ensureSuperAdmin();
await backfillSourcePermissions();
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
