import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  Download,
  Landmark,
  Layers3,
  LineChart,
  PlugZap,
  RefreshCcw,
  School,
  Search,
  ShieldCheck,
  Sparkles,
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
  const [sources, setSources] = useState(baseSources);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Menunggu koneksi API saldo masuk.');

  const loadFinanceData = useCallback(async () => {
    try {
      const [sourcesResponse, transactionsResponse] = await Promise.all([
        fetch('/api/finance/sources'),
        fetch('/api/finance/transactions'),
      ]);

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
  }, []);

  const syncApiSources = useCallback(async () => {
    setIsSyncing(true);
    setSyncMessage('Mengambil saldo dari API lalu menyimpan ke database lokal...');

    try {
      const response = await fetch('/api/finance/sync', { method: 'POST' });

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
  }, []);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

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

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="brand">
          <div className="brand-mark">V</div>
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
          <strong>AI Cashflow Guard</strong>
          <span>Memantau anomali hanya dari data real yang masuk.</span>
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
            <button className="primary-button" disabled={isSyncing} onClick={syncApiSources}>
              <RefreshCcw size={18} className={isSyncing ? 'spin-icon' : ''} />
              {isSyncing ? 'Sinkron...' : 'Sinkron API'}
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
            <div className="empty-state">
              <BadgeCheck size={22} />
              <strong>Belum ada transaksi real yang tersinkron.</strong>
              <span>Data transaksi akan muncul setelah API Simpaskor atau Forbasi mengirim saldo masuk.</span>
            </div>
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
