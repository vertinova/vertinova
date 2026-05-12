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
  Menu,
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
type ViewId = 'dashboard' | 'sources' | 'integrations' | 'reconciliation' | 'reports';

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

const navItems: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LineChart },
  { id: 'sources', label: 'Pendapatan', icon: WalletCards },
  { id: 'integrations', label: 'Integrasi API', icon: PlugZap },
  { id: 'reconciliation', label: 'Rekonsiliasi', icon: BadgeCheck },
  { id: 'reports', label: 'Laporan', icon: Download },
];

const emptyCashflow = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu'].map((month) => ({
  month,
  income: 0,
  expense: 0,
}));

const emptyWeeklyApi = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => ({
  day,
  simpaskor: 0,
  forbasi: 0,
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
  const [detailModal, setDetailModal] = useState<'simpaskor' | 'forbasi' | null>(null);
  const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
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

  const fetchDetail = useCallback(
    async (sourceId: 'simpaskor' | 'forbasi') => {
      setDetailModal(sourceId);
      setDetailItems([]);
      setIsLoadingDetail(true);
      try {
        const response = await authedFetch(`/api/finance/details/${sourceId}`);
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload.message ?? `Gagal mengambil detail ${sourceId}.`);
        }
        const payload = (await response.json()) as { items: DetailItem[] };
        setDetailItems(payload.items);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : `Gagal mengambil detail ${sourceId}.`);
        setDetailModal(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [authedFetch],
  );

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
  const currentWeeklyApi = emptyWeeklyApi.map((row, index) =>
    index === emptyWeeklyApi.length - 1
      ? {
          ...row,
          simpaskor: toMillions(sources.find((source) => source.id === 'simpaskor')?.amount ?? 0),
          forbasi: toMillions(sources.find((source) => source.id === 'forbasi')?.amount ?? 0),
        }
      : row,
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

  const activeLabel = navItems.find((item) => item.id === activeView)?.label ?? 'Dashboard';

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
      <button className="mobile-menu" aria-label="Buka menu" onClick={() => setSidebarOpen(true)}>
        <Menu size={20} />
      </button>

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
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={activeView === id ? 'active' : ''}
              key={id}
              onClick={() => {
                setActiveView(id);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span>Status sistem</span>
          <strong>{connectedCount}/2 API sinkron</strong>
          <p>{syncMessage}</p>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Vertinova Finance</p>
            <h1>{activeLabel}</h1>
            <span className="page-subtitle">Pantau saldo, koneksi API, rekonsiliasi, dan laporan dalam satu ruang kerja.</span>
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
            <button className="icon-button" aria-label="Logout" onClick={handleLogout}>
              <LogOut size={20} />
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
            currentWeeklyApi={currentWeeklyApi}
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

        {activeView === 'sources' ? (
          <SourcesView sources={filteredSources} totalIncome={totalIncome} onExportSources={exportSources} />
        ) : null}

        {activeView === 'integrations' ? (
          <IntegrationsView apiSources={apiSources} isSyncing={isSyncing} onSync={syncApiSources} onViewDetail={fetchDetail} />
        ) : null}

        {activeView === 'reconciliation' ? (
          <ReconciliationView transactions={filteredTransactions} onExportTransactions={exportTransactions} />
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

      {detailModal ? (
        <DetailModal
          isLoading={isLoadingDetail}
          items={detailItems}
          sourceId={detailModal}
          onClose={() => setDetailModal(null)}
        />
      ) : null}
    </main>
  );
}

function DashboardView({
  apiIncome,
  currentCashflow,
  currentWeeklyApi,
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
  currentWeeklyApi: Array<{ day: string; simpaskor: number; forbasi: number }>;
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
  return (
    <>
      <section className="summary-grid">
        <MetricCard icon={Banknote} label="Total saldo" value={formatCurrency(totalIncome)} note={syncMessage} tone="dark" />
        <MetricCard icon={PlugZap} label="Saldo API" value={formatCurrency(apiIncome)} note="Simpaskor + Forbasi" />
        <MetricCard icon={Landmark} label="Manual" value={formatCurrency(manualIncome)} note="Desa, Sekolah, Swasta" />
        <MetricCard icon={BadgeCheck} label="Terverifikasi" value={`${verifiedCount}/${transactions.length}`} note="Transaksi terbaru" />
      </section>

      <section className="source-grid">
        {sources.map((source, index) => (
          <SourceCard key={source.id} source={source} index={index} />
        ))}
      </section>

      <section className="analytics-grid">
        <article className="panel wide">
          <PanelTitle eyebrow="Cashflow" title="Tren pemasukan" action={<span className="soft-chip">8 bulan</span>} />
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value} jt`} />
                <Tooltip formatter={(value) => `${value} juta`} />
                <Area type="monotone" dataKey="income" stroke="#15803d" strokeWidth={3} fill="url(#incomeGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <PanelTitle eyebrow="Komposisi" title="Sumber pendapatan" />
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
          <LegendList items={sourceChart} />
        </article>

        <article className="panel">
          <PanelTitle eyebrow="Saldo API" title="Simpaskor vs Forbasi" />
          <div className="chart-area small">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentWeeklyApi}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value} jt`} />
                <Tooltip formatter={(value) => `${value} juta`} />
                <Bar dataKey="simpaskor" fill="#16a34a" radius={[7, 7, 0, 0]} />
                <Bar dataKey="forbasi" fill="#2563eb" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <ReconciliationView compact transactions={filteredTransactions.slice(0, 6)} onExportTransactions={onExportTransactions} />
    </>
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
  onSync,
  onViewDetail,
}: {
  apiSources: RevenueSource[];
  isSyncing: boolean;
  onSync: () => void;
  onViewDetail: (sourceId: 'simpaskor' | 'forbasi') => void;
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
              <button className="ghost-button" onClick={() => onViewDetail(source.id as 'simpaskor' | 'forbasi')}>
                <Eye size={17} />
                Lihat Detail
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

function ReconciliationView({
  compact = false,
  transactions,
  onExportTransactions,
}: {
  compact?: boolean;
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
        eyebrow="Rekonsiliasi"
        title={compact ? 'Detail transaksi API terbaru' : 'Detail transaksi API'}
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
  title,
  transactions,
}: {
  color: string;
  title: string;
  transactions: Transaction[];
}) {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

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
  const total = items.reduce((sum, item) => sum + item.adminFee * (item.quantity || 1), 0);
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
