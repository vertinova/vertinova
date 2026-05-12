import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  CheckCircle2,
  Cloud,
  Code2,
  DatabaseZap,
  Download,
  Eye,
  Landmark,
  Layers3,
  LineChart,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  PlugZap,
  RefreshCcw,
  School,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import loginBackground from '../bg-landing-page.jpg';
import logo from '../logo-vertinova.png';

type SourceId = 'simpaskor' | 'forbasi' | 'desa' | 'sekolah' | 'swasta';
type ApiSourceId = Extract<SourceId, 'simpaskor' | 'forbasi'>;
type ViewId = 'dashboard' | 'transactions' | 'reports';
type NavItem = {
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'Monitor' | 'Operasional';
};

type RevenueSource = {
  id: SourceId;
  name: string;
  category: 'api' | 'manual';
  amount: number;
  growth: number;
  target: number;
  color: string;
  icon: LucideIcon;
  status: 'Sinkron' | 'API Belum Terhubung' | 'Manual';
  description: string;
  lastSync?: string | null;
  message?: string;
};

type Transaction = {
  id: string;
  sourceId: SourceId;
  source: string;
  description: string;
  date: string;
  amount: number;
  status: 'Terverifikasi' | 'Review' | 'Terjadwal';
};

type ApiSourcePayload = {
  id: SourceId;
  amount: number;
  status: RevenueSource['status'];
  lastSync?: string | null;
  message?: string;
};

type DetailItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  quantity: number;
  adminFee: number;
  paidAt: string;
  orderId: string;
};

type TransactionDetailState = Record<ApiSourceId, { error: string; isLoading: boolean; items: DetailItem[] }>;

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
};

const baseSources: RevenueSource[] = [
  {
    id: 'simpaskor',
    name: 'Simpaskor',
    category: 'api',
    amount: 0,
    growth: 0,
    target: 0,
    color: '#16a34a',
    icon: PlugZap,
    status: 'API Belum Terhubung',
    description: 'Saldo masuk otomatis dari API Simpaskor.',
  },
  {
    id: 'forbasi',
    name: 'Forbasi',
    category: 'api',
    amount: 0,
    growth: 0,
    target: 0,
    color: '#2563eb',
    icon: ShieldCheck,
    status: 'API Belum Terhubung',
    description: 'Saldo masuk otomatis dari API Forbasi.',
  },
  {
    id: 'desa',
    name: 'Desa',
    category: 'manual',
    amount: 0,
    growth: 0,
    target: 0,
    color: '#d97706',
    icon: Landmark,
    status: 'Manual',
    description: 'Pendapatan desa belum diisi manual.',
  },
  {
    id: 'sekolah',
    name: 'Sekolah',
    category: 'manual',
    amount: 0,
    growth: 0,
    target: 0,
    color: '#db2777',
    icon: School,
    status: 'Manual',
    description: 'Pendapatan sekolah belum diisi manual.',
  },
  {
    id: 'swasta',
    name: 'Swasta',
    category: 'manual',
    amount: 0,
    growth: 0,
    target: 0,
    color: '#7c3aed',
    icon: Building2,
    status: 'Manual',
    description: 'Pendapatan swasta belum diisi manual.',
  },
];

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Ringkasan',
    description: 'Saldo dan kondisi utama',
    icon: LineChart,
    group: 'Monitor',
  },
  {
    id: 'transactions',
    label: 'Transaksi',
    description: 'Detail Simpaskor dan Forbasi',
    icon: BadgeCheck,
    group: 'Operasional',
  },
  {
    id: 'reports',
    label: 'Ekspor Data',
    description: 'CSV sumber dan transaksi',
    icon: Download,
    group: 'Operasional',
  },
];

const navGroups: NavItem['group'][] = ['Monitor', 'Operasional'];

const emptyTransactionDetails: TransactionDetailState = {
  simpaskor: { error: '', isLoading: false, items: [] },
  forbasi: { error: '', isLoading: false, items: [] },
};

const emptyCashflow = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu'].map((month) => ({
  month,
  income: 0,
  expense: 0,
}));


const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return 'Belum pernah';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toMillions = (value: number) => Math.round(value / 1_000_000);

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

function App() {
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [sources, setSources] = useState(baseSources);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('vertinova_token') ?? '');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [syncMessage, setSyncMessage] = useState('Menunggu koneksi API saldo masuk.');
  const [notice, setNotice] = useState('Dashboard siap digunakan.');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminPath = routePath.startsWith('/admin');

  useEffect(() => {
    const handleRouteChange = () => setRoutePath(window.location.pathname);
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  const authedFetch = useCallback(
    (url: string, init?: RequestInit) =>
      fetch(url, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${authToken}`,
        },
      }),
    [authToken],
  );

  const mergeApiSources = useCallback((payloadSources: ApiSourcePayload[]) => {
    const apiById = new Map(payloadSources.map((source) => [source.id, source]));

    setSources((currentSources) =>
      currentSources.map((source) => {
        const apiSource = apiById.get(source.id);

        if (!apiSource) {
          return source.category === 'manual' ? { ...source, amount: 0, growth: 0, target: 0 } : source;
        }

        return {
          ...source,
          amount: apiSource.amount,
          status: apiSource.status,
          target: apiSource.amount > 0 ? 100 : 0,
          growth: 0,
          lastSync: apiSource.lastSync ?? null,
          message: apiSource.message,
        };
      }),
    );
  }, []);

  const loadFinanceData = useCallback(async () => {
    try {
      const response = await authedFetch('/api/finance/dashboard');

      if (response.status === 401) {
        throw new Error('Sesi berakhir. Silakan login ulang.');
      }

      if (!response.ok) {
        throw new Error('API finance proxy tidak merespons dengan benar.');
      }

      const payload = (await response.json()) as {
        sources: ApiSourcePayload[];
        transactions: Transaction[];
      };

      mergeApiSources(payload.sources);
      setTransactions(payload.transactions);
      setSyncMessage('Data dibaca dari database lokal Vertinova Finance.');
      setNotice('Data finance berhasil dimuat.');
    } catch (error) {
      setSources(baseSources);
      setTransactions([]);
      setSyncMessage(error instanceof Error ? error.message : 'Gagal mengambil saldo API.');
      setNotice('Data belum bisa dimuat. Periksa API atau sesi login.');
    }
  }, [authedFetch, mergeApiSources]);

  const syncApiSources = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage('Mengambil saldo dari API lalu menyimpan ke database lokal...');

    try {
      const response = await authedFetch('/api/finance/sync', { method: 'POST' });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? 'API finance proxy tidak merespons dengan benar.');
      }

      const payload = (await response.json()) as {
        sources: ApiSourcePayload[];
        transactions: Transaction[];
      };

      mergeApiSources(payload.sources);
      setTransactions(payload.transactions);
      setSyncMessage('Sinkronisasi selesai dan tersimpan ke database lokal.');
      setNotice('Sinkronisasi API selesai.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Gagal mengambil saldo API.');
      setNotice('Sinkronisasi gagal. Detail muncul di panel status.');
    } finally {
      setIsSyncing(false);
    }
  }, [authedFetch, mergeApiSources]);

  useEffect(() => {
    const boot = async () => {
      if (!isAdminPath || !authToken) {
        setIsBooting(false);
        return;
      }

      try {
        const response = await authedFetch('/api/auth/me');

        if (!response.ok) {
          throw new Error('Sesi tidak valid.');
        }

        const payload = (await response.json()) as { user: AdminUser };
        setUser(payload.user);
        await loadFinanceData();
      } catch {
        localStorage.removeItem('vertinova_token');
        setAuthToken('');
        setUser(null);
      } finally {
        setIsBooting(false);
      }
    };

    void boot();
  }, [authToken, authedFetch, isAdminPath, loadFinanceData]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message ?? 'Login gagal.');
      }

      localStorage.setItem('vertinova_token', payload.token);
      setAuthToken(payload.token);
      setUser(payload.user);
      setNotice(`Selamat datang, ${payload.user.name}.`);
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    if (authToken) {
      await authedFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    }

    localStorage.removeItem('vertinova_token');
    setAuthToken('');
    setUser(null);
    setSources(baseSources);
    setTransactions([]);
    window.history.pushState(null, '', '/admin');
    setRoutePath('/admin');
  }, [authToken, authedFetch]);

  const filteredSources = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sources;
    return sources.filter((source) =>
      [source.name, source.status, source.description, source.message ?? ''].join(' ').toLowerCase().includes(keyword),
    );
  }, [query, sources]);

  const filteredTransactions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return transactions;
    return transactions.filter((transaction) =>
      [transaction.id, transaction.sourceId, transaction.source, transaction.description, transaction.status]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, transactions]);

  const totalIncome = useMemo(() => sources.reduce((sum, source) => sum + source.amount, 0), [sources]);
  const apiIncome = useMemo(
    () => sources.filter((source) => source.category === 'api').reduce((sum, source) => sum + source.amount, 0),
    [sources],
  );
  const manualIncome = totalIncome - apiIncome;
  const verifiedCount = transactions.filter((transaction) => transaction.status === 'Terverifikasi').length;
  const connectedCount = sources.filter((source) => source.status === 'Sinkron').length;
  const apiSources = sources.filter((source) => source.category === 'api');
  const sourceChart = sources.map((source) => ({ name: source.name, value: source.amount, color: source.color }));
  const currentCashflow = emptyCashflow.map((row, index) =>
    index === emptyCashflow.length - 1 ? { ...row, income: toMillions(totalIncome) } : row,
  );
  const exportSources = () => {
    downloadCsv(
      `vertinova-sumber-pendapatan-${new Date().toISOString().slice(0, 10)}.csv`,
      sources.map((source) => ({
        sumber: source.name,
        kategori: source.category,
        status: source.status,
        saldo: source.amount,
        terakhir_sinkron: formatDate(source.lastSync),
      })),
    );
    setNotice('CSV sumber pendapatan dibuat.');
  };

  const exportTransactions = () => {
    if (transactions.length === 0) {
      setNotice('Belum ada transaksi untuk diexport.');
      return;
    }

    downloadCsv(
      `vertinova-transaksi-${new Date().toISOString().slice(0, 10)}.csv`,
      transactions.map((transaction) => ({
        id: transaction.id,
        sumber: transaction.source,
        deskripsi: transaction.description,
        tanggal: new Date(transaction.date).toLocaleString('id-ID'),
        nominal: transaction.amount,
        status: transaction.status,
      })),
    );
    setNotice('CSV transaksi dibuat.');
  };

  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const activeLabel = activeNav.label;
  const activeSubtitle = activeNav.description;

  if (!isAdminPath) {
    return <LandingPage />;
  }

  if (isBooting) {
    return (
      <main className="boot-screen">
        <img src={logo} alt="Vertinova" />
        <span>Memuat Vertinova Finance...</span>
      </main>
    );
  }

  if (!authToken || !user) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navigasi utama">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Vertinova" />
          <div>
            <strong>Vertinova</strong>
            <span>Finance Control</span>
          </div>
          <button className="close-sidebar" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="nav-list">
          {navGroups.map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {navItems
                .filter((item) => item.group === group)
                .map(({ id, label, description, icon: Icon }) => (
                  <button
                    className={activeView === id ? 'active' : ''}
                    key={id}
                    onClick={() => {
                      setActiveView(id);
                      setSidebarOpen(false);
                    }}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-card">
          <span>Ringkasan cepat</span>
          <strong>{formatCurrency(totalIncome)}</strong>
          <div className="sidebar-meta">
            <span>{connectedCount}/2 API sinkron</span>
            <span>{verifiedCount}/{transactions.length} transaksi valid</span>
          </div>
          <button className="sidebar-sync" disabled={isSyncing} onClick={syncApiSources}>
            {isSyncing ? <Loader2 size={16} className="spin-icon" /> : <RefreshCcw size={16} />}
            {isSyncing ? 'Sinkronisasi...' : 'Sinkron sekarang'}
          </button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="topbar-main">
            <div className="topbar-copy">
              <p className="eyebrow">Vertinova Finance</p>
              <h1>{activeLabel}</h1>
              <span className="page-subtitle">{activeSubtitle}. Pantau saldo, koneksi API, rekonsiliasi, dan laporan dalam satu ruang kerja.</span>
            </div>
            <button className="header-logout" aria-label="Logout" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari sumber, transaksi, status"
              />
            </label>
            <button className="icon-button" aria-label={notice} title={notice} onClick={() => setNotice(syncMessage)}>
              <Bell size={20} />
            </button>
            <button className="ghost-button user-button" title={user.email}>
              <UserRound size={17} />
              {user.name}
            </button>
            <button className="primary-button" disabled={isSyncing} onClick={syncApiSources}>
              {isSyncing ? <Loader2 size={18} className="spin-icon" /> : <RefreshCcw size={18} />}
              {isSyncing ? 'Sinkron...' : 'Sinkron API'}
            </button>
          </div>
        </header>

        <section className="notice-bar">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </section>

        {activeView === 'dashboard' ? (
          <DashboardView
            apiIncome={apiIncome}
            currentCashflow={currentCashflow}
            filteredTransactions={filteredTransactions}
            manualIncome={manualIncome}
            sources={filteredSources}
            sourceChart={sourceChart}
            syncMessage={syncMessage}
            totalIncome={totalIncome}
            transactions={transactions}
            verifiedCount={verifiedCount}
            onExportTransactions={exportTransactions}
          />
        ) : null}

        {activeView === 'transactions' ? (
          <TransactionsView
            query={query}
            sources={sources}
            transactions={filteredTransactions}
            onExportTransactions={exportTransactions}
            onRefreshTransactions={loadFinanceData}
          />
        ) : null}

        {activeView === 'reports' ? (
          <ReportsView
            apiIncome={apiIncome}
            manualIncome={manualIncome}
            sources={sources}
            totalIncome={totalIncome}
            transactions={transactions}
            onExportSources={exportSources}
            onExportTransactions={exportTransactions}
          />
        ) : null}
      </section>

      <nav className="bottom-nav" aria-label="Navigasi utama mobile">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            aria-label={label}
            aria-current={activeView === id ? 'page' : undefined}
            className={activeView === id ? 'active' : ''}
            key={id}
            onClick={() => {
              setActiveView(id);
              setSidebarOpen(false);
            }}
          >
            <Icon size={19} />
          </button>
        ))}
      </nav>
    </main>
  );
}

function DashboardView({
  apiIncome,
  currentCashflow,
  filteredTransactions,
  manualIncome,
  sources,
  sourceChart,
  syncMessage,
  totalIncome,
  transactions,
  verifiedCount,
  onExportTransactions,
}: {
  apiIncome: number;
  currentCashflow: Array<{ month: string; income: number; expense: number }>;
  filteredTransactions: Transaction[];
  manualIncome: number;
  sources: RevenueSource[];
  sourceChart: Array<{ name: string; value: number; color: string }>;
  syncMessage: string;
  totalIncome: number;
  transactions: Transaction[];
  verifiedCount: number;
  onExportTransactions: () => void;
}) {
  const connectedCount = sources.filter((s) => s.status === 'Sinkron').length;
  const simpaskor = sources.find((s) => s.id === 'simpaskor');
  const forbasi = sources.find((s) => s.id === 'forbasi');
  const manualSources = sources.filter((s) => s.category === 'manual');

  const simpaskorPct = totalIncome > 0 ? (simpaskor?.amount ?? 0) / totalIncome * 100 : 0;
  const forbasiPct = totalIncome > 0 ? (forbasi?.amount ?? 0) / totalIncome * 100 : 0;
  const manualPct = Math.max(0, 100 - simpaskorPct - forbasiPct);

  return (
    <>
      {/* ── Hero ── */}
      <motion.section className="db-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="db-hero-left">
          <p className="db-hero-eyebrow">Total admin fee masuk</p>
          <strong className="db-hero-total">{formatCurrency(totalIncome)}</strong>
          <div className="db-breakdown-bar">
            <span style={{ width: `${simpaskorPct}%`, backgroundColor: '#16a34a' }} title={`Simpaskor ${simpaskorPct.toFixed(1)}%`} />
            <span style={{ width: `${forbasiPct}%`, backgroundColor: '#2563eb' }} title={`Forbasi ${forbasiPct.toFixed(1)}%`} />
            <span style={{ width: `${manualPct}%`, backgroundColor: '#d97706' }} title={`Manual ${manualPct.toFixed(1)}%`} />
          </div>
          <div className="db-hero-legend">
            <span><i style={{ backgroundColor: '#16a34a' }} />Simpaskor {formatCurrency(simpaskor?.amount ?? 0)}</span>
            <span><i style={{ backgroundColor: '#2563eb' }} />Forbasi {formatCurrency(forbasi?.amount ?? 0)}</span>
            <span><i style={{ backgroundColor: '#d97706' }} />Manual {formatCurrency(manualIncome)}</span>
          </div>
          <p className="db-hero-note">{syncMessage}</p>
        </div>
        <div className="db-hero-stats">
          <div className="db-stat">
            <Banknote size={18} />
            <strong>{formatCurrency(apiIncome)}</strong>
            <span>Saldo API</span>
          </div>
          <div className="db-stat">
            <Landmark size={18} />
            <strong>{formatCurrency(manualIncome)}</strong>
            <span>Saldo manual</span>
          </div>
          <div className="db-stat">
            <PlugZap size={18} />
            <strong>{connectedCount}/2</strong>
            <span>API sinkron</span>
          </div>
          <div className="db-stat">
            <BadgeCheck size={18} />
            <strong>{verifiedCount}/{transactions.length}</strong>
            <span>Terverifikasi</span>
          </div>
        </div>
      </motion.section>

      {/* ── Sumber ── */}
      <section className="db-sources-row">
        <DbApiPanel source={simpaskor} totalIncome={totalIncome} />
        <DbApiPanel source={forbasi} totalIncome={totalIncome} />
        <DbManualPanel sources={manualSources} totalIncome={totalIncome} />
      </section>

      {/* ── Charts ── */}
      <section className="analytics-grid">
        <article className="panel wide">
          <PanelTitle eyebrow="Cashflow" title="Tren pemasukan" action={<span className="soft-chip">2026</span>} />
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentCashflow}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v} jt`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} juta`, 'Pemasukan']} />
                <Area type="monotone" dataKey="income" stroke="#15803d" strokeWidth={3} fill="url(#incomeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <PanelTitle eyebrow="Komposisi" title="Sumber pendapatan" />
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceChart} innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {sourceChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <LegendList items={sourceChart} />
        </article>
      </section>

      {/* ── Transaksi terbaru ── */}
      <ReconciliationView compact transactions={filteredTransactions.slice(0, 8)} onExportTransactions={onExportTransactions} />
    </>
  );
}

function DbApiPanel({ source, totalIncome }: { source: RevenueSource | undefined; totalIncome: number }) {
  if (!source) return null;
  const pct = totalIncome > 0 ? (source.amount / totalIncome) * 100 : 0;

  return (
    <motion.article className="db-api-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="db-panel-header">
        <div className="source-icon" style={{ backgroundColor: `${source.color}1f`, color: source.color }}>
          <source.icon size={22} />
        </div>
        <div>
          <h3>{source.name}</h3>
          <StatusPill status={source.status} />
        </div>
      </div>

      <strong className="db-panel-amount">{formatCurrency(source.amount)}</strong>

      <div className="db-pct-row">
        <span>{pct.toFixed(1)}% dari total</span>
        <div className="db-pct-track">
          <span style={{ width: `${pct}%`, backgroundColor: source.color }} />
        </div>
      </div>

      <dl className="db-panel-dl">
        <div>
          <dt>Terakhir sinkron</dt>
          <dd>{formatDate(source.lastSync)}</dd>
        </div>
        <div>
          <dt>Keterangan</dt>
          <dd>{source.message ?? source.description}</dd>
        </div>
      </dl>
    </motion.article>
  );
}

function DbManualPanel({ sources, totalIncome }: { sources: RevenueSource[]; totalIncome: number }) {
  const total = sources.reduce((sum, s) => sum + s.amount, 0);
  const pct = totalIncome > 0 ? (total / totalIncome) * 100 : 0;

  return (
    <motion.article className="db-api-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="db-panel-header">
        <div className="source-icon" style={{ backgroundColor: '#d9770620', color: '#d97706' }}>
          <Landmark size={22} />
        </div>
        <div>
          <h3>Manual</h3>
          <span className="status-pill neutral">Manual</span>
        </div>
      </div>

      <strong className="db-panel-amount">{formatCurrency(total)}</strong>

      <div className="db-pct-row">
        <span>{pct.toFixed(1)}% dari total</span>
        <div className="db-pct-track">
          <span style={{ width: `${pct}%`, backgroundColor: '#d97706' }} />
        </div>
      </div>

      <div className="db-manual-list">
        {sources.map((s) => (
          <div key={s.id} className="db-manual-item">
            <div>
              <s.icon size={14} style={{ color: s.color }} />
              <span>{s.name}</span>
            </div>
            <strong>{formatCurrency(s.amount)}</strong>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

function SourcesView({
  sources,
  totalIncome,
  onExportSources,
}: {
  sources: RevenueSource[];
  totalIncome: number;
  onExportSources: () => void;
}) {
  return (
    <section className="panel">
      <PanelTitle
        eyebrow="Pendapatan"
        title="Daftar sumber dana"
        action={
          <button className="ghost-button" onClick={onExportSources}>
            <Download size={17} />
            Export CSV
          </button>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sumber</th>
              <th>Kategori</th>
              <th>Status</th>
              <th>Saldo</th>
              <th>Terakhir sinkron</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <span className="table-source">
                    <source.icon size={18} style={{ color: source.color }} />
                    {source.name}
                  </span>
                </td>
                <td>{source.category === 'api' ? 'API' : 'Manual'}</td>
                <td>
                  <StatusPill status={source.status} />
                </td>
                <td>{formatCurrency(source.amount)}</td>
                <td>{formatDate(source.lastSync)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td>{formatCurrency(totalIncome)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function IntegrationsView({
  apiSources,
  isSyncing,
  onOpenTransactions,
  onSync,
}: {
  apiSources: RevenueSource[];
  isSyncing: boolean;
  onOpenTransactions: () => void;
  onSync: () => void;
}) {
  return (
    <section className="integration-grid">
      {apiSources.map((source) => (
        <article className="panel integration-card" key={source.id}>
          <div className="source-header">
            <div className="source-icon" style={{ backgroundColor: `${source.color}1f`, color: source.color }}>
              <source.icon size={22} />
            </div>
            <StatusPill status={source.status} />
          </div>
          <h2>{source.name}</h2>
          <p>{source.message ?? source.description}</p>
          <dl>
            <div>
              <dt>Saldo</dt>
              <dd>{formatCurrency(source.amount)}</dd>
            </div>
            <div>
              <dt>Terakhir sinkron</dt>
              <dd>{formatDate(source.lastSync)}</dd>
            </div>
          </dl>
          <div className="integration-actions">
            <button className="primary-button" disabled={isSyncing} onClick={onSync}>
              {isSyncing ? <Loader2 size={18} className="spin-icon" /> : <RefreshCcw size={18} />}
              Sinkron semua API
            </button>
            {source.status === 'Sinkron' ? (
              <button className="ghost-button" onClick={onOpenTransactions}>
                <Eye size={17} />
                Lihat Transaksi
              </button>
            ) : null}
          </div>
        </article>
      ))}

      <article className="panel endpoint-panel">
        <PanelTitle eyebrow="Endpoint" title="Konektor server" />
        <EndpointRow icon={Layers3} title="/api/finance/simpaskor/balance" note="Mengambil saldo Simpaskor dengan header X-API-Key." />
        <EndpointRow icon={PlugZap} title="/api/finance/forbasi/balance" note="Mengambil saldo Forbasi dengan header X-API-Key." />
        <EndpointRow icon={ServerCog} title="/api/finance/sync" note="Menarik semua API dan menyimpan transaksi harian." />
      </article>
    </section>
  );
}

function TransactionsView({
  query,
  sources,
  transactions,
  onExportTransactions,
  onRefreshTransactions,
}: {
  query: string;
  sources: RevenueSource[];
  transactions: Transaction[];
  onExportTransactions: () => void;
  onRefreshTransactions: () => void;
}) {
  const keyword = query.trim().toLowerCase();
  const sourceConfigs: Array<{ color: string; id: ApiSourceId; title: string }> = [
    { id: 'simpaskor', title: 'Simpaskor', color: '#16a34a' },
    { id: 'forbasi', title: 'Forbasi', color: '#2563eb' },
  ];
  const apiSources = sources.filter((source): source is RevenueSource & { id: ApiSourceId } =>
    source.id === 'simpaskor' || source.id === 'forbasi',
  );
  const totalApiAmount = apiSources.reduce((sum, source) => sum + source.amount, 0);
  const verifiedTransactions = transactions.filter((transaction) => transaction.status === 'Terverifikasi').length;
  const sourceTotals = Object.fromEntries(apiSources.map((source) => [source.id, source.amount])) as Record<ApiSourceId, number>;

  return (
    <section className="transactions-page">
      <article className="panel transaction-overview">
        <PanelTitle
          eyebrow="Transaksi"
          title="Transaksi Simpaskor dan Forbasi"
          action={
            <div className="transaction-actions">
              <button className="ghost-button" onClick={onRefreshTransactions}>
                <RefreshCcw size={17} />
                Muat ulang
              </button>
              <button className="ghost-button" onClick={onExportTransactions}>
                <Download size={17} />
                Export
              </button>
            </div>
          }
        />
        <div className="transaction-overview-grid">
          <div>
            <span>Total transaksi API</span>
            <strong>{formatCurrency(totalApiAmount)}</strong>
          </div>
          <div>
            <span>Terverifikasi</span>
            <strong>{verifiedTransactions}</strong>
          </div>
          <div>
            <span>Transaksi tersimpan</span>
            <strong>{transactions.length}</strong>
          </div>
        </div>
      </article>

      <div className="transaction-detail-grid">
        {sourceConfigs.map((source) => (
          <TransactionSourcePanel
            color={source.color}
            key={source.id}
            sourceId={source.id}
            total={sourceTotals[source.id] ?? 0}
            transactions={transactions.filter((transaction) => transaction.sourceId === source.id)}
            title={source.title}
          />
        ))}
      </div>

      <ReconciliationView compact sourceTotals={sourceTotals} transactions={transactions} onExportTransactions={onExportTransactions} />
    </section>
  );
}

function TransactionSourcePanel({
  color,
  sourceId,
  total,
  transactions,
  title,
}: {
  color: string;
  sourceId: ApiSourceId;
  total: number;
  transactions: Transaction[];
  title: string;
}) {
  return (
    <article className="panel transaction-detail-panel">
      <div className="transaction-detail-head">
        <div>
          <span className="source-dot" style={{ backgroundColor: color }} />
          <p className="eyebrow">{sourceId}</p>
          <h2>{title}</h2>
        </div>
        <div>
          <strong>{formatCurrency(total)}</strong>
          <span>{transactions.length} transaksi tersimpan</span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Belum ada transaksi." note="Data akan muncul setelah webhook pembayaran berhasil diterima." />
      ) : (
        <div className="table-wrap detail-table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Keterangan</th>
                <th>Nominal</th>
                <th>Tanggal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={`${sourceId}-${transaction.id}`}>
                  <td className="detail-order-id">{transaction.id}</td>
                  <td>
                    <div className="detail-cell-title">{transaction.description}</div>
                    <div className="detail-cell-sub">{transaction.source}</div>
                  </td>
                  <td>{formatCurrency(transaction.amount)}</td>
                  <td>{formatDate(transaction.date)}</td>
                  <td><span className={`transaction-status ${transaction.status.toLowerCase()}`}>{transaction.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function ReconciliationView({
  compact = false,
  sourceTotals,
  transactions,
  onExportTransactions,
}: {
  compact?: boolean;
  sourceTotals?: Partial<Record<ApiSourceId, number>>;
  transactions: Transaction[];
  onExportTransactions: () => void;
}) {
  const apiTransactionGroups = [
    {
      id: 'simpaskor' as const,
      title: 'Simpaskor',
      color: '#16a34a',
      transactions: transactions.filter((transaction) => transaction.sourceId === 'simpaskor'),
    },
    {
      id: 'forbasi' as const,
      title: 'Forbasi',
      color: '#2563eb',
      transactions: transactions.filter((transaction) => transaction.sourceId === 'forbasi'),
    },
  ];
  const otherTransactions = transactions.filter(
    (transaction) => transaction.sourceId !== 'simpaskor' && transaction.sourceId !== 'forbasi',
  );

  return (
    <section className="panel">
      <PanelTitle
        eyebrow={compact ? 'Transaksi' : 'Rekonsiliasi'}
        title={compact ? 'Transaksi tersimpan terbaru' : 'Detail transaksi API'}
        action={
          <button className="ghost-button" onClick={onExportTransactions}>
            <Download size={17} />
            Export
          </button>
        }
      />
      {transactions.length > 0 ? (
        <>
          <div className="transaction-split">
            {apiTransactionGroups.map((group) => (
              <TransactionGroup
                color={group.color}
                key={group.id}
                totalOverride={sourceTotals?.[group.id]}
                title={group.title}
                transactions={group.transactions}
              />
            ))}
          </div>
          {otherTransactions.length > 0 ? (
            <TransactionGroup color="#d97706" title="Transaksi lainnya" transactions={otherTransactions} />
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={BadgeCheck}
          title="Belum ada transaksi real yang tersinkron."
          note="Data transaksi akan muncul setelah API Simpaskor atau Forbasi mengirim saldo masuk."
        />
      )}
    </section>
  );
}

function TransactionGroup({
  color,
  totalOverride,
  title,
  transactions,
}: {
  color: string;
  totalOverride?: number;
  title: string;
  transactions: Transaction[];
}) {
  const total = totalOverride ?? transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="transaction-group">
      <div className="transaction-group-header">
        <div>
          <span className="source-dot" style={{ backgroundColor: color }} />
          <strong>{title}</strong>
        </div>
        <span>
          {transactions.length} transaksi - {formatCurrency(total)}
        </span>
      </div>
      {transactions.length > 0 ? (
        <div className="transaction-list">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} showSource={false} />
          ))}
        </div>
      ) : (
        <div className="empty-transaction-group">Belum ada transaksi.</div>
      )}
    </div>
  );
}

function ReportsView({
  apiIncome,
  manualIncome,
  sources,
  totalIncome,
  transactions,
  onExportSources,
  onExportTransactions,
}: {
  apiIncome: number;
  manualIncome: number;
  sources: RevenueSource[];
  totalIncome: number;
  transactions: Transaction[];
  onExportSources: () => void;
  onExportTransactions: () => void;
}) {
  const connected = sources.filter((source) => source.status === 'Sinkron').length;
  const verified = transactions.filter((transaction) => transaction.status === 'Terverifikasi').length;

  return (
    <section className="reports-grid">
      <article className="panel report-main">
        <PanelTitle eyebrow="Laporan" title="Ringkasan keuangan" />
        <div className="report-total">
          <span>Total saldo tercatat</span>
          <strong>{formatCurrency(totalIncome)}</strong>
        </div>
        <div className="report-lines">
          <ReportLine label="Saldo API" value={formatCurrency(apiIncome)} />
          <ReportLine label="Saldo manual" value={formatCurrency(manualIncome)} />
          <ReportLine label="API sinkron" value={`${connected}/2`} />
          <ReportLine label="Transaksi terverifikasi" value={`${verified}/${transactions.length}`} />
        </div>
      </article>
      <article className="panel">
        <PanelTitle eyebrow="Export" title="Unduh data" />
        <div className="export-actions">
          <button className="primary-button" onClick={onExportSources}>
            <Download size={18} />
            Sumber pendapatan
          </button>
          <button className="ghost-button" onClick={onExportTransactions}>
            <Download size={18} />
            Transaksi
          </button>
        </div>
      </article>
    </section>
  );
}

function LoginView({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('admin@vertinova.id');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <img className="login-bg" src={loginBackground} alt="" />
      <section className="login-copy">
        <img src={logo} alt="Vertinova" />
        <span>Finance Management</span>
        <h1>Ruang kendali pendapatan Vertinova.</h1>
        <p>Masuk sebagai admin untuk memantau sumber dana, sinkronisasi API, dan rekonsiliasi transaksi.</p>
      </section>
      <motion.form className="login-panel" onSubmit={handleSubmit} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <p className="eyebrow">Secure Access</p>
          <h2>Login Admin</h2>
        </div>

        <label className="form-field">
          <span>Email</span>
          <div>
            <Mail size={18} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@vertinova.id"
              autoComplete="email"
              required
            />
          </div>
        </label>

        <label className="form-field">
          <span>Password</span>
          <div>
            <LockKeyhole size={18} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Masukkan password"
              autoComplete="current-password"
              required
            />
          </div>
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-button login-submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
          {isSubmitting ? 'Memeriksa...' : 'Masuk Dashboard'}
        </button>
      </motion.form>
    </main>
  );
}

function LandingPage() {
  const capabilities = [
    { title: 'Software Development', description: 'Aplikasi web, mobile, dashboard, dan sistem operasional.', icon: Code2 },
    { title: 'Cloud & Infrastructure', description: 'Deployment, server hardening, monitoring, dan otomasi.', icon: Cloud },
    { title: 'Data & AI Automation', description: 'Integrasi data, otomasi proses, dan AI assistant.', icon: DatabaseZap },
    { title: 'API Integration', description: 'Koneksi antar platform, payment, webhook, dan layanan pihak ketiga.', icon: PlugZap },
  ];

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <main className="site-page">
      <section className="site-hero">
        <img src={loginBackground} alt="" />
        <div className="site-overlay" />
        <header className="site-nav">
          <div className="brand light">
            <img className="brand-logo" src={logo} alt="Vertinova" />
            <div>
              <strong>Vertinova</strong>
              <span>Technology Partner</span>
            </div>
          </div>
          <nav>
            <button onClick={() => scrollTo('capabilities')}>Kapabilitas</button>
            <a href="mailto:hello@vertinova.id">Kontak</a>
            <a className="site-login" href="/admin">
              Masuk
            </a>
          </nav>
        </header>
        <div className="site-hero-content">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <span className="site-pill">
              <Sparkles size={16} />
              Digital product studio
            </span>
            <h1>Vertinova</h1>
            <p>
              Kami membangun aplikasi, integrasi API, otomasi, dan infrastruktur digital yang rapi, stabil,
              dan siap dipakai tim operasional.
            </p>
            <div className="site-actions">
              <a href="mailto:hello@vertinova.id?subject=Konsultasi%20Project%20Vertinova">
                Konsultasi Project
                <ArrowRight size={18} />
              </a>
              <button onClick={() => scrollTo('capabilities')}>Lihat Kapabilitas</button>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="capabilities" className="site-section">
        <div className="section-heading">
          <p className="eyebrow">Kapabilitas</p>
          <h2>Sistem digital yang dirancang untuk kerja nyata.</h2>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article key={capability.title}>
              <capability.icon size={24} />
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Vertinova</span>
        <a href="mailto:hello@vertinova.id">hello@vertinova.id</a>
      </footer>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  note,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  note: string;
  tone?: 'dark';
  value: string;
}) {
  return (
    <motion.article className={`metric-card ${tone === 'dark' ? 'dark' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </motion.article>
  );
}

function SourceCard({ index, source }: { index: number; source: RevenueSource }) {
  return (
    <motion.article className="source-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <div className="source-header">
        <div className="source-icon" style={{ backgroundColor: `${source.color}1f`, color: source.color }}>
          <source.icon size={20} />
        </div>
        <StatusPill status={source.status} />
      </div>
      <h3>{source.name}</h3>
      <strong>{formatCurrency(source.amount)}</strong>
      <p>{source.message ?? source.description}</p>
      <span className="sync-time">Sinkron: {formatDate(source.lastSync)}</span>
      <div className="progress-track">
        <span style={{ width: `${source.target}%`, backgroundColor: source.color }} />
      </div>
    </motion.article>
  );
}

function StatusPill({ status }: { status: RevenueSource['status'] }) {
  const className = status === 'Sinkron' ? 'success' : status === 'Manual' ? 'neutral' : 'warning';
  return <span className={`status-pill ${className}`}>{status}</span>;
}

function PanelTitle({ action, eyebrow, title }: { action?: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <div className="panel-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function LegendList({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="legend-list">
      {items.map((item) => (
        <span key={item.name}>
          <i style={{ backgroundColor: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

function TransactionRow({ showSource = true, transaction }: { showSource?: boolean; transaction: Transaction }) {
  return (
    <div className="transaction-row">
      <div>
        {showSource ? <strong>{transaction.source}</strong> : null}
        <span>{transaction.id} - {transaction.description}</span>
      </div>
      <div>
        <b>{formatCurrency(transaction.amount)}</b>
        <span>{new Date(transaction.date).toLocaleString('id-ID')}</span>
      </div>
      <span className={`transaction-status ${transaction.status.toLowerCase()}`}>{transaction.status}</span>
    </div>
  );
}

function EndpointRow({ icon: Icon, note, title }: { icon: LucideIcon; note: string; title: string }) {
  return (
    <div className="endpoint-row">
      <Icon size={20} />
      <div>
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, note, title }: { icon: LucideIcon; note: string; title: string }) {
  return (
    <div className="empty-state">
      <Icon size={24} />
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  );
}

function ReportLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailModal({
  isLoading,
  items,
  sourceId,
  onClose,
}: {
  isLoading: boolean;
  items: DetailItem[];
  sourceId: 'simpaskor' | 'forbasi';
  onClose: () => void;
}) {
  const total = items.reduce((sum, item) => sum + item.adminFee, 0);
  const title = sourceId === 'simpaskor' ? 'Detail Transaksi Simpaskor' : 'Detail Transaksi Forbasi';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Transaksi</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Tutup" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="modal-loading">
            <Loader2 size={28} className="spin-icon" />
            <span>Memuat detail transaksi...</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={BadgeCheck} title="Belum ada transaksi." note="Tidak ada data transaksi yang ditemukan." />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipe</th>
                    <th>Nama / Event</th>
                    <th>Qty</th>
                    <th>Admin Fee</th>
                    <th>Tanggal Bayar</th>
                    <th>Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><span className="type-chip">{item.type}</span></td>
                      <td>
                        <div className="detail-cell-title">{item.title}</div>
                        {item.subtitle ? <div className="detail-cell-sub">{item.subtitle}</div> : null}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{formatCurrency(item.adminFee)}</td>
                      <td>{formatDate(item.paidAt)}</td>
                      <td className="detail-order-id">{item.orderId || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total ({items.length} transaksi)</td>
                    <td>{formatCurrency(total)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
