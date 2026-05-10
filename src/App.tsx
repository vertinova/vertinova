import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import loginBackground from '../bg-landing-page.jpg';
import logo from '../logo-vertinova.png';
import {
  Activity,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  BrainCircuit,
  Building2,
  CalendarDays,
  Cloud,
  Code2,
  DatabaseZap,
  Download,
  Globe2,
  Landmark,
  Layers3,
  LineChart,
  LogOut,
  Mail,
  PlugZap,
  RefreshCcw,
  Rocket,
  School,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
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

type SourceId = 'simpaskor' | 'forbasi' | 'desa' | 'sekolah' | 'swasta';

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
};

type Transaction = {
  id: string;
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
  lastSync?: string;
  message?: string;
};

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
    color: '#23c483',
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
    color: '#3b82f6',
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
    color: '#f59e0b',
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
    color: '#ef5da8',
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
    color: '#8b5cf6',
    icon: Building2,
    status: 'Manual',
    description: 'Pendapatan swasta belum diisi manual.',
  },
];

const emptyCashflow = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
].map((month) => ({ month, income: 0, expense: 0 }));

const emptyWeeklyApi = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => ({
  day,
  simpaskor: 0,
  forbasi: 0,
}));

const navItems: Array<[string, LucideIcon]> = [
  ['Dashboard', LineChart],
  ['Pendapatan', WalletCards],
  ['Integrasi API', PlugZap],
  ['Rekonsiliasi', BadgeCheck],
  ['Laporan', Download],
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);

const toMillions = (value: number) => Math.round(value / 1_000_000);

function App() {
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [sources, setSources] = useState(baseSources);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('vertinova_token') ?? '');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [syncMessage, setSyncMessage] = useState('Menunggu koneksi API saldo masuk.');
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

  const loadFinanceData = useCallback(async () => {
    try {
      const [sourcesResponse, transactionsResponse] = await Promise.all([
        authedFetch('/api/finance/sources'),
        authedFetch('/api/finance/transactions'),
      ]);

      if (sourcesResponse.status === 401 || transactionsResponse.status === 401) {
        throw new Error('Sesi berakhir. Silakan login ulang.');
      }

      if (!sourcesResponse.ok || !transactionsResponse.ok) {
        throw new Error('API finance proxy tidak merespons dengan benar.');
      }

      const sourcesPayload = (await sourcesResponse.json()) as { sources: ApiSourcePayload[] };
      const transactionsPayload = (await transactionsResponse.json()) as { transactions: Transaction[] };
      const payload = sourcesPayload;
      const apiById = new Map(payload.sources.map((source) => [source.id, source]));

      setSources((currentSources) =>
        currentSources.map((source) => {
          const apiSource = apiById.get(source.id);

          if (!apiSource) {
            return source.category === 'manual'
              ? { ...source, amount: 0, growth: 0, target: 0 }
              : source;
          }

          return {
            ...source,
            amount: apiSource.amount,
            status: apiSource.status,
            target: apiSource.amount > 0 ? 100 : 0,
            growth: 0,
            description: apiSource.message ?? source.description,
          };
        }),
      );
      setTransactions(transactionsPayload.transactions);

      setSyncMessage('Data dibaca dari database lokal Vertinova Finance.');
    } catch (error) {
      setSources(baseSources);
      setTransactions([]);
      setSyncMessage(error instanceof Error ? error.message : 'Gagal mengambil saldo API.');
    }
  }, [authedFetch]);

  const syncApiSources = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage('Mengambil saldo dari API lalu menyimpan ke database lokal...');

    try {
      const response = await authedFetch('/api/finance/sync', { method: 'POST' });

      if (!response.ok) {
        throw new Error('API finance proxy tidak merespons dengan benar.');
      }

      const payload = (await response.json()) as {
        sources: ApiSourcePayload[];
        transactions: Transaction[];
      };
      const apiById = new Map(payload.sources.map((source) => [source.id, source]));

      setSources((currentSources) =>
        currentSources.map((source) => {
          const apiSource = apiById.get(source.id);

          if (!apiSource) {
            return source.category === 'manual'
              ? { ...source, amount: 0, growth: 0, target: 0 }
              : source;
          }

          return {
            ...source,
            amount: apiSource.amount,
            status: apiSource.status,
            target: apiSource.amount > 0 ? 100 : 0,
            growth: 0,
            description: apiSource.message ?? source.description,
          };
        }),
      );
      setTransactions(payload.transactions);
      setSyncMessage('Sinkronisasi selesai dan tersimpan ke database lokal.');
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Gagal mengambil saldo API.');
    } finally {
      setIsSyncing(false);
    }
  }, [authedFetch]);

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

  const handleLogin = useCallback(async (email: string, password: string) => {
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
  }, []);

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

  const totalIncome = useMemo(
    () => sources.reduce((sum, source) => sum + source.amount, 0),
    [sources],
  );
  const apiIncome = useMemo(
    () =>
      sources
        .filter((source) => source.category === 'api')
        .reduce((sum, source) => sum + source.amount, 0),
    [sources],
  );
  const sourceChart = useMemo(
    () =>
      sources.map((source) => ({
        name: source.name,
        value: source.amount,
        color: source.color,
      })),
    [sources],
  );
  const currentCashflow = useMemo(
    () =>
      emptyCashflow.map((row, index) =>
        index === emptyCashflow.length - 1 ? { ...row, income: toMillions(totalIncome) } : row,
      ),
    [totalIncome],
  );
  const currentWeeklyApi = useMemo(() => {
    const simpaskor = sources.find((source) => source.id === 'simpaskor')?.amount ?? 0;
    const forbasi = sources.find((source) => source.id === 'forbasi')?.amount ?? 0;

    return emptyWeeklyApi.map((row, index) =>
      index === emptyWeeklyApi.length - 1
        ? { ...row, simpaskor: toMillions(simpaskor), forbasi: toMillions(forbasi) }
        : row,
    );
  }, [sources]);

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
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="brand">
          <img className="brand-logo" src={logo} alt="Vertinova" />
          <div>
            <strong>Vertinova</strong>
            <span>Finance OS</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(([label, Icon]) => (
            <button className={label === 'Dashboard' ? 'active' : ''} key={label}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sync-panel">
          <Sparkles size={20} />
          <strong>{user.name}</strong>
          <span>{user.role === 'super_admin' ? 'Super Admin' : 'Admin'} aktif di sesi ini.</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Management Keuangan Vertinova</p>
            <h1>Kontrol pendapatan lintas unit dalam satu dashboard.</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={18} />
              <input placeholder="Cari transaksi, sumber, invoice" />
            </label>
            <button className="icon-button" aria-label="Notifikasi">
              <Bell size={20} />
            </button>
            <button className="ghost-button user-button">
              <UserRound size={17} />
              {user.name}
            </button>
            <button className="primary-button" disabled={isSyncing} onClick={syncApiSources}>
              <RefreshCcw size={18} className={isSyncing ? 'spin-icon' : ''} />
              {isSyncing ? 'Sinkron...' : 'Sinkron API'}
            </button>
            <button className="icon-button" aria-label="Logout" onClick={handleLogout}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <section className="hero-grid">
          <motion.div
            className="finance-hero"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="hero-copy">
              <span className="status-pill">
                <Activity size={16} />
                Data real API-first
              </span>
              <h2>{formatCurrency(totalIncome)}</h2>
              <p>{syncMessage}</p>
            </div>
            <div className="orbital">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="core">
                <Banknote size={34} />
                <span>{formatCurrency(apiIncome)}</span>
              </div>
            </div>
          </motion.div>

          <div className="metric-stack">
            <MetricCard title="API Income" value={formatCurrency(apiIncome)} note="Simpaskor + Forbasi" trend="Real" />
            <MetricCard title="Rasio Verifikasi" value={`0/${transactions.length}`} note="Belum ada transaksi manual" trend="Aktif" />
          </div>
        </section>

        <section className="source-grid">
          {sources.map((source, index) => (
            <motion.article
              className="source-card"
              key={source.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.45 }}
            >
              <div className="source-header">
                <div className="source-icon" style={{ backgroundColor: `${source.color}1f`, color: source.color }}>
                  <source.icon size={20} />
                </div>
                <span className={`source-status ${source.category}`}>{source.status}</span>
              </div>
              <h3>{source.name}</h3>
              <strong>{formatCurrency(source.amount)}</strong>
              <p>{source.description}</p>
              <div className="progress-track">
                <span style={{ width: `${source.target}%`, backgroundColor: source.color }} />
              </div>
              <div className="source-footer">
                <span>Data real {source.target}%</span>
                <b>{source.growth}%</b>
              </div>
            </motion.article>
          ))}
        </section>

        <section className="analytics-grid">
          <article className="panel wide">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Cashflow</p>
                <h2>Tren pemasukan dan pengeluaran</h2>
              </div>
              <button className="ghost-button">
                <CalendarDays size={17} />
                8 Bulan
              </button>
            </div>
            <div className="chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentCashflow}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#23c483" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#23c483" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef5da8" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#ef5da8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe8e4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value} jt`} />
                  <Tooltip formatter={(value) => `${value} juta`} />
                  <Area type="monotone" dataKey="income" stroke="#159463" strokeWidth={3} fill="url(#incomeGradient)" />
                  <Area type="monotone" dataKey="expense" stroke="#ef5da8" strokeWidth={2} fill="url(#expenseGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Komposisi</p>
                <h2>Sumber pendapatan</h2>
              </div>
            </div>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={sourceChart} innerRadius={58} outerRadius={88} paddingAngle={5} dataKey="value">
                    {sourceChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-list">
              {sourceChart.map((item) => (
                <span key={item.name}>
                  <i style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Saldo API</p>
                <h2>Simpaskor vs Forbasi</h2>
              </div>
            </div>
            <div className="chart-area small">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={currentWeeklyApi}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dfe8e4" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value} jt`} />
                  <Tooltip formatter={(value) => `${value} juta`} />
                  <Bar dataKey="simpaskor" fill="#23c483" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="forbasi" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="panel transactions-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">Rekonsiliasi</p>
                <h2>Transaksi terbaru</h2>
              </div>
              <button className="ghost-button">
                <Download size={17} />
                Export
              </button>
            </div>
            {transactions.length > 0 ? (
              <div className="transaction-list">
                {transactions.map((transaction) => (
                  <div className="transaction-row" key={transaction.id}>
                    <div>
                      <strong>{transaction.source}</strong>
                      <span>{transaction.description}</span>
                    </div>
                    <div>
                      <b>{formatCurrency(transaction.amount)}</b>
                      <span>{new Date(transaction.date).toLocaleString('id-ID')}</span>
                    </div>
                    <span className={`transaction-status ${transaction.status.toLowerCase()}`}>
                      {transaction.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <BadgeCheck size={22} />
                <strong>Belum ada transaksi real yang tersinkron.</strong>
                <span>Data transaksi akan muncul setelah API Simpaskor atau Forbasi mengirim saldo masuk.</span>
              </div>
            )}
          </article>

          <article className="panel integration-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">API Ready</p>
                <h2>Konektor saldo masuk</h2>
              </div>
            </div>
            <div className="endpoint-card">
              <Layers3 size={22} />
              <div>
                <strong>/api/finance/simpaskor/balance</strong>
                <span>Proxy server memakai header X-API-Key dari environment.</span>
              </div>
            </div>
            <div className="endpoint-card blue">
              <PlugZap size={22} />
              <div>
                <strong>/api/finance/forbasi/balance</strong>
                <span>Siap disambungkan setelah URL dan credential Forbasi tersedia.</span>
              </div>
            </div>
            <div className="ai-note">
              <ArrowUpRight size={18} />
              <span>Semua sumber non-API tetap 0 sampai ada input atau endpoint resmi.</span>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function LandingPage() {
  const capabilities = [
    {
      title: 'Software Development',
      description: 'Aplikasi web, mobile, dashboard, dan sistem operasional yang dibuat sesuai alur bisnis.',
      icon: Code2,
    },
    {
      title: 'Cloud & Infrastructure',
      description: 'Deployment, server hardening, automation, monitoring, dan arsitektur yang siap tumbuh.',
      icon: Cloud,
    },
    {
      title: 'Data & AI Automation',
      description: 'Integrasi data, otomasi proses, AI assistant, dan pipeline kerja yang lebih cepat.',
      icon: BrainCircuit,
    },
    {
      title: 'API Integration',
      description: 'Koneksi sistem antar platform, webhook, payment, dan layanan pihak ketiga.',
      icon: DatabaseZap,
    },
  ];
  const process = ['Discovery', 'Prototype', 'Build', 'Launch', 'Scale'];

  return (
    <main className="min-h-screen overflow-hidden bg-[#071914] text-white">
      <section className="relative min-h-screen">
        <img className="absolute inset-0 h-full w-full object-cover opacity-35" src={loginBackground} alt="" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,25,20,.96),rgba(7,25,20,.72)_48%,rgba(7,25,20,.36)),linear-gradient(180deg,rgba(7,25,20,.08),#071914_92%)]" />
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <img className="h-11 w-11 rounded-xl bg-white object-contain p-1" src={logo} alt="Vertinova" />
            <div>
              <strong className="block text-lg">Vertinova</strong>
              <span className="text-xs uppercase tracking-[.24em] text-emerald-100/70">Technology Partner</span>
            </div>
          </div>
          <a
            className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white hover:text-[#071914] sm:inline-flex"
            href="mailto:hello@vertinova.id"
          >
            Hubungi Kami
          </a>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] max-w-7xl items-center gap-10 px-5 pb-14 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/10 px-4 py-2 text-sm font-bold text-emerald-100 backdrop-blur">
              <Sparkles size={16} />
              Digital product studio for ambitious teams
            </span>
            <h1 className="mt-6 max-w-5xl text-[clamp(3.2rem,8vw,7.6rem)] font-black leading-[.88] tracking-normal text-white">
              Teknologi yang membuat bisnis bergerak lebih cepat.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
              Vertinova membantu perusahaan merancang, membangun, dan menjalankan sistem digital modern:
              dari aplikasi, integrasi API, otomasi, sampai infrastruktur cloud yang stabil.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#b9ffdc] px-5 font-black text-[#071914] shadow-[0_24px_60px_rgba(35,196,131,.25)] transition hover:-translate-y-0.5"
                href="mailto:hello@vertinova.id?subject=Konsultasi%20Project%20Vertinova"
              >
                Konsultasi Project
                <ArrowRight size={18} />
              </a>
              <a
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 font-bold text-white backdrop-blur transition hover:bg-white hover:text-[#071914]"
                href="#capabilities"
              >
                Lihat Kapabilitas
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_28px_90px_rgba(0,0,0,.28)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-black uppercase text-emerald-100/70">Delivery System</p>
                <h2 className="mt-1 text-2xl font-black">From idea to launch</h2>
              </div>
              <Rocket className="text-[#b9ffdc]" size={28} />
            </div>
            <div className="mt-5 grid gap-3">
              {process.map((item, index) => (
                <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3" key={item}>
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#b9ffdc] font-black text-[#071914]">
                    {index + 1}
                  </span>
                  <span className="font-bold text-white/90">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="capabilities" className="bg-[#f4f7f2] px-5 py-20 text-[#10231f] sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase text-[#377463]">Kapabilitas</p>
              <h2 className="mt-2 max-w-3xl text-[clamp(2.2rem,5vw,4.8rem)] font-black leading-[.95]">
                Sistem digital yang dirancang untuk kerja nyata.
              </h2>
            </div>
            <p className="max-w-md leading-7 text-[#65766f]">
              Kami fokus pada solusi yang bisa dipakai tim, mudah dirawat, dan punya ruang untuk berkembang
              saat bisnis bertambah besar.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((capability) => (
              <article
                className="rounded-2xl border border-[#dbe6df] bg-white p-5 shadow-[0_22px_60px_rgba(45,65,57,.09)]"
                key={capability.title}
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e6f9ef] text-[#0e6d49]">
                  <capability.icon size={23} />
                </div>
                <h3 className="mt-5 text-xl font-black">{capability.title}</h3>
                <p className="mt-3 leading-7 text-[#65766f]">{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-[#10231f] sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-3xl bg-[#071914] p-6 text-white md:grid-cols-[1fr_auto] md:items-center md:p-9">
          <div>
            <p className="text-xs font-black uppercase text-[#b9ffdc]">Siap membangun?</p>
            <h2 className="mt-2 text-[clamp(2rem,4vw,4rem)] font-black leading-none">
              Mari ubah proses bisnis menjadi produk digital yang solid.
            </h2>
          </div>
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-black text-[#071914] transition hover:-translate-y-0.5"
            href="mailto:hello@vertinova.id?subject=Konsultasi%20Teknologi%20Vertinova"
          >
            Mulai Diskusi
            <Globe2 size={18} />
          </a>
        </div>
      </section>

      <footer className="bg-[#071914] px-5 py-8 text-white/60 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm sm:flex-row">
          <span>© {new Date().getFullYear()} Vertinova. Technology partner for modern business.</span>
          <span className="inline-flex items-center gap-2">
            <ServerCog size={16} />
            vertinova.id
          </span>
        </div>
      </footer>
    </main>
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
      <motion.form
        className="login-panel"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
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
            <ShieldCheck size={18} />
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
          {isSubmitting ? 'Memeriksa...' : 'Masuk Dashboard'}
        </button>
      </motion.form>
    </main>
  );
}

function MetricCard({
  title,
  value,
  note,
  trend,
}: {
  title: string;
  value: string;
  note: string;
  trend: string;
}) {
  return (
    <motion.article
      className="metric-card"
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <div className="trend-chip">
        {trend.startsWith('+') ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        {trend}
      </div>
    </motion.article>
  );
}

export default App;
