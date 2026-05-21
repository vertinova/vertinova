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
type ViewId = 'dashboard' | 'transactions' | 'reports' | 'accounts' | 'revenueShares';
type NavItem = {
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'Monitor' | 'Operasional' | 'Akses';
  permission: string;
};

type SimpaskorSummary = {
  currency?: string;
  totalSimpaskorBalance: number;
  adminFee: {
    total: number;
    ticket: number;
    voting: number;
    registration: number;
    qrisFee: number;
  };
  platformShare: {
    total: number;
    fromTickets: number;
    fromVoting: number;
    ticketGrossRevenue: number;
    votingGrossRevenue: number;
  };
  packagePayments: {
    total: number;
    byTier: Record<string, number>;
  };
  fetchedAt?: string | null;
};

type SimpaskorRevenueShareBalances = {
  currency?: string;
  scope?: string;
  summary: {
    grossRevenue: number;
    ticketGrossRevenue: number;
    votingGrossRevenue: number;
    platformShare: number;
    panitiaShare: number;
    ticketRevenue: number;
    votingRevenue: number;
    totalWithdrawn: number;
    totalPending: number;
    activeBalance: number;
    lockedPlatformShare: number;
    activePlatformShare: number;
  };
  counts?: {
    events: number;
    revenueShares: number;
  };
  events?: unknown[];
  fetchedAt?: string | null;
};

type SimpaskorBreakdown = {
  adminFee: number;
  qrisFee?: number;
  platformShare: number;
  packagePayments: number;
  bagiHasil: number;
  total: number;
  platformGross?: number;
  sharePercent?: {
    effective: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  counts?: {
    platformShare: number;
    packagePayments: number;
  };
  summary?: SimpaskorSummary | null;
  revenueShareBalances?: SimpaskorRevenueShareBalances | null;
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
  breakdown?: SimpaskorBreakdown | null;
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
  breakdown?: SimpaskorBreakdown | null;
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
  username: string;
  email?: string | null;
  role: string;
  permissions: string[];
  revenueSharePercent: number;
};

type PermissionCatalogItem = {
  id: string;
  label: string;
  feature: string;
};

type ManagedUser = AdminUser & {
  isActive: boolean;
  lastLoginAt?: string | null;
  revenueShareAmount: number;
};

type AccessPayload = {
  permissionCatalog: PermissionCatalogItem[];
  totalIncome: number;
  users: ManagedUser[];
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
    permission: 'finance.dashboard',
  },
  {
    id: 'transactions',
    label: 'Transaksi',
    description: 'Detail Simpaskor dan Forbasi',
    icon: BadgeCheck,
    group: 'Operasional',
    permission: 'finance.transactions',
  },
  {
    id: 'reports',
    label: 'Ekspor Data',
    description: 'CSV sumber dan transaksi',
    icon: Download,
    group: 'Operasional',
    permission: 'finance.reports',
  },
  {
    id: 'accounts',
    label: 'Akun',
    description: 'Role dan permission',
    icon: ShieldCheck,
    group: 'Akses',
    permission: 'accounts.manage',
  },
  {
    id: 'revenueShares',
    label: 'Persentase',
    description: 'Pembagian pendapatan',
    icon: WalletCards,
    group: 'Akses',
    permission: 'revenue_shares.manage',
  },
];

const navGroups: NavItem['group'][] = ['Monitor', 'Operasional', 'Akses'];

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

type ExcelCell = {
  value: string | number | Date | null;
  type?: 'String' | 'Number' | 'DateTime';
  style?: 'title' | 'meta' | 'header' | 'text' | 'currency' | 'date' | 'total' | 'totalCurrency';
};

type ExcelSheet = {
  name: string;
  columns: number[];
  rows: ExcelCell[][];
};

const excelDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const xmlEscape = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const excelCell = (cell: ExcelCell) => {
  const style = cell.style ?? (cell.type === 'Number' ? 'text' : cell.type === 'DateTime' ? 'date' : 'text');
  const value = cell.value ?? '';
  const dataType = cell.type ?? (typeof value === 'number' ? 'Number' : value instanceof Date ? 'DateTime' : 'String');
  const serializedValue = value instanceof Date ? value.toISOString() : xmlEscape(value);

  return `<Cell ss:StyleID="${style}"><Data ss:Type="${dataType}">${serializedValue}</Data></Cell>`;
};

const excelRow = (cells: ExcelCell[]) => `<Row>${cells.map(excelCell).join('')}</Row>`;

const excelWorksheet = (sheet: ExcelSheet) => `
  <Worksheet ss:Name="${xmlEscape(sheet.name)}">
    <Table>
      ${sheet.columns.map((width) => `<Column ss:Width="${width}" />`).join('')}
      ${sheet.rows.map(excelRow).join('')}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes />
      <FrozenNoSplit />
      <SplitHorizontal>3</SplitHorizontal>
      <TopRowBottomPane>3</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>`;

const downloadExcel = (filename: string, sheets: ExcelSheet[]) => {
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#10251f" /><Interior ss:Color="#dff3ea" ss:Pattern="Solid" /></Style>
    <Style ss:ID="meta"><Font ss:Color="#53645f" /></Style>
    <Style ss:ID="header"><Font ss:Bold="1" ss:Color="#ffffff" /><Interior ss:Color="#12372f" ss:Pattern="Solid" /><Alignment ss:Horizontal="Center" /></Style>
    <Style ss:ID="text"><Alignment ss:Vertical="Top" /></Style>
    <Style ss:ID="currency"><NumberFormat ss:Format="&quot;Rp&quot; #,##0" /></Style>
    <Style ss:ID="date"><NumberFormat ss:Format="dd mmm yyyy hh:mm" /></Style>
    <Style ss:ID="total"><Font ss:Bold="1" /><Interior ss:Color="#eef7f2" ss:Pattern="Solid" /></Style>
    <Style ss:ID="totalCurrency"><Font ss:Bold="1" /><Interior ss:Color="#eef7f2" ss:Pattern="Solid" /><NumberFormat ss:Format="&quot;Rp&quot; #,##0" /></Style>
  </Styles>
  ${sheets.map(excelWorksheet).join('')}
</Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const buildSummarySheet = ({
  sources,
  transactions,
  totalIncome,
  apiIncome,
  manualIncome,
}: {
  sources: RevenueSource[];
  transactions: Transaction[];
  totalIncome: number;
  apiIncome: number;
  manualIncome: number;
}): ExcelSheet => {
  const connected = sources.filter((source) => source.status === 'Sinkron').length;
  const verified = transactions.filter((transaction) => transaction.status === 'Terverifikasi').length;

  return {
    name: 'Ringkasan',
    columns: [190, 150, 160, 190],
    rows: [
      [{ value: 'Vertinova Finance Export', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }],
      [{ value: 'Dibuat pada', style: 'meta' }, { value: new Date(), type: 'DateTime', style: 'date' }, { value: 'Format', style: 'meta' }, { value: 'Excel Workbook', style: 'meta' }],
      [{ value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
      [{ value: 'Metrik', style: 'header' }, { value: 'Nilai', style: 'header' }, { value: 'Catatan', style: 'header' }, { value: 'Status', style: 'header' }],
      [{ value: 'Total saldo tercatat' }, { value: totalIncome, type: 'Number', style: 'currency' }, { value: 'Semua sumber pendapatan' }, { value: 'Aktif' }],
      [{ value: 'Saldo API' }, { value: apiIncome, type: 'Number', style: 'currency' }, { value: 'Simpaskor + Forbasi' }, { value: `${connected}/2 sinkron` }],
      [{ value: 'Saldo manual' }, { value: manualIncome, type: 'Number', style: 'currency' }, { value: 'Desa, Sekolah, Swasta' }, { value: 'Manual' }],
      [{ value: 'Transaksi terverifikasi' }, { value: verified, type: 'Number' }, { value: `Dari ${transactions.length} transaksi` }, { value: 'Terverifikasi' }],
    ],
  };
};

const buildSourcesSheet = (sources: RevenueSource[], totalIncome: number): ExcelSheet => ({
  name: 'Sumber Pendapatan',
  columns: [140, 95, 130, 135, 165, 310],
  rows: [
    [{ value: 'Sumber Pendapatan', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }],
    [{ value: 'Dibuat pada', style: 'meta' }, { value: new Date(), type: 'DateTime', style: 'date' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    [{ value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    ['Sumber', 'Kategori', 'Status', 'Saldo', 'Terakhir Sinkron', 'Catatan'].map((value) => ({ value, style: 'header' })),
    ...sources.map((source) => [
      { value: source.name },
      { value: source.category === 'api' ? 'API' : 'Manual' },
      { value: source.status },
      { value: source.amount, type: 'Number' as const, style: 'currency' as const },
      { value: excelDate(source.lastSync), type: 'DateTime' as const, style: 'date' as const },
      { value: source.message ?? source.description },
    ]),
    [
      { value: 'Total', style: 'total' },
      { value: '', style: 'total' },
      { value: '', style: 'total' },
      { value: totalIncome, type: 'Number', style: 'totalCurrency' },
      { value: '', style: 'total' },
      { value: '', style: 'total' },
    ],
  ],
});

const buildTransactionsSheet = (transactions: Transaction[]): ExcelSheet => ({
  name: 'Transaksi',
  columns: [110, 135, 280, 160, 130, 120],
  rows: [
    [{ value: 'Transaksi Finance', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }],
    [{ value: 'Dibuat pada', style: 'meta' }, { value: new Date(), type: 'DateTime', style: 'date' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    [{ value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    ['ID', 'Sumber', 'Deskripsi', 'Tanggal', 'Nominal', 'Status'].map((value) => ({ value, style: 'header' })),
    ...transactions.map((transaction) => [
      { value: transaction.id },
      { value: transaction.source },
      { value: transaction.description },
      { value: excelDate(transaction.date), type: 'DateTime' as const, style: 'date' as const },
      { value: transaction.amount, type: 'Number' as const, style: 'currency' as const },
      { value: transaction.status },
    ]),
    [
      { value: 'Total', style: 'total' },
      { value: transactions.length, type: 'Number', style: 'total' },
      { value: '', style: 'total' },
      { value: '', style: 'total' },
      { value: transactions.reduce((sum, transaction) => sum + transaction.amount, 0), type: 'Number', style: 'totalCurrency' },
      { value: '', style: 'total' },
    ],
  ],
});

const buildSourceRecapSheet = (sources: RevenueSource[], transactions: Transaction[]): ExcelSheet => ({
  name: 'Rekap Per Sumber',
  columns: [140, 130, 130, 150, 160],
  rows: [
    [{ value: 'Rekap Per Sumber', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }, { value: '', style: 'title' }],
    [{ value: 'Dibuat pada', style: 'meta' }, { value: new Date(), type: 'DateTime', style: 'date' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    [{ value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }, { value: '', style: 'meta' }],
    ['Sumber', 'Saldo Sumber', 'Jumlah Transaksi', 'Nominal Transaksi', 'Status'].map((value) => ({ value, style: 'header' })),
    ...sources.map((source) => {
      const sourceTransactions = transactions.filter((transaction) => transaction.sourceId === source.id);
      return [
        { value: source.name },
        { value: source.amount, type: 'Number' as const, style: 'currency' as const },
        { value: sourceTransactions.length, type: 'Number' as const },
        { value: sourceTransactions.reduce((sum, transaction) => sum + transaction.amount, 0), type: 'Number' as const, style: 'currency' as const },
        { value: source.status },
      ];
    }),
  ],
});

function App() {
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [sources, setSources] = useState(baseSources);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [isBooting, setIsBooting] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('vertinova_token') ?? '');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessData, setAccessData] = useState<AccessPayload | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Menunggu koneksi API saldo masuk.');
  const [notice, setNotice] = useState('Dashboard siap digunakan.');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminPath = routePath.startsWith('/admin');
  const allowedNavItems = useMemo(
    () => navItems.filter((item) => user?.permissions.includes(item.permission)),
    [user],
  );

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
          breakdown: apiSource.breakdown ?? null,
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

  const loadAccessData = useCallback(async () => {
    if (!authToken) return;
    setIsAccessLoading(true);

    try {
      const response = await authedFetch('/api/admin/access');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message ?? 'Data akses belum bisa dimuat.');
      }

      const payload = (await response.json()) as AccessPayload;
      setAccessData(payload);
      setNotice('Data akun dan pembagian persentase dimuat.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Data akses belum bisa dimuat.');
    } finally {
      setIsAccessLoading(false);
    }
  }, [authToken, authedFetch]);

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

  useEffect(() => {
    if (!user || allowedNavItems.some((item) => item.id === activeView)) return;
    setActiveView(allowedNavItems[0]?.id ?? 'dashboard');
  }, [activeView, allowedNavItems, user]);

  useEffect(() => {
    if (!user || !['accounts', 'revenueShares'].includes(activeView)) return;
    void loadAccessData();
  }, [activeView, loadAccessData, user]);

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
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
    downloadExcel(`vertinova-sumber-pendapatan-${new Date().toISOString().slice(0, 10)}.xls`, [
      buildSummarySheet({ sources, transactions, totalIncome, apiIncome, manualIncome }),
      buildSourcesSheet(sources, totalIncome),
      buildSourceRecapSheet(sources, transactions),
    ]);
    setNotice('Excel sumber pendapatan dibuat.');
  };

  const exportTransactions = () => {
    if (transactions.length === 0) {
      setNotice('Belum ada transaksi untuk diexport ke Excel.');
      return;
    }

    downloadExcel(`vertinova-transaksi-${new Date().toISOString().slice(0, 10)}.xls`, [
      buildSummarySheet({ sources, transactions, totalIncome, apiIncome, manualIncome }),
      buildTransactionsSheet(transactions),
      buildSourceRecapSheet(sources, transactions),
    ]);
    setNotice('Excel transaksi dibuat.');
  };

  const activeNav = allowedNavItems.find((item) => item.id === activeView) ?? allowedNavItems[0] ?? navItems[0];
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
          {navGroups.map((group) => {
            const items = allowedNavItems.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div className="nav-group" key={group}>
                <span className="nav-group-label">{group}</span>
                {items.map(({ id, label, description, icon: Icon }) => (
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
            );
          })}
        </nav>

        <div className="sidebar-card">
          <span>Ringkasan cepat</span>
          <strong>{formatCurrency(totalIncome)}</strong>
          <div className="sidebar-meta">
            <span>{connectedCount}/2 API sinkron</span>
            <span>{verifiedCount}/{transactions.length} transaksi valid</span>
          </div>
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
            <button className="ghost-button user-button" title={user.username}>
              <UserRound size={17} />
              {user.name}
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
            user={user}
            verifiedCount={verifiedCount}
            onExportTransactions={exportTransactions}
          />
        ) : null}

        {activeView === 'transactions' ? (
          <TransactionsView
            sources={sources}
            transactions={filteredTransactions}
            user={user}
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

        {activeView === 'accounts' ? (
          <AccountsView
            accessData={accessData}
            isLoading={isAccessLoading}
            onReload={loadAccessData}
            onSave={async (payload) => {
              const response = await authedFetch('/api/admin/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message ?? 'Akun gagal dibuat.');
              setAccessData(data);
              setNotice('Akun baru berhasil dibuat.');
            }}
            onUpdate={async (accountId, payload) => {
              const response = await authedFetch(`/api/admin/accounts/${accountId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message ?? 'Akun gagal diperbarui.');
              setAccessData(data);
              setNotice('Akun berhasil diperbarui.');
            }}
          />
        ) : null}

        {activeView === 'revenueShares' ? (
          <RevenueSharesView
            accessData={accessData}
            isLoading={isAccessLoading}
            onReload={loadAccessData}
            onUpdate={async (accountId, payload) => {
              const response = await authedFetch(`/api/admin/accounts/${accountId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.message ?? 'Persentase gagal diperbarui.');
              setAccessData(data);
              setNotice('Pembagian persentase berhasil diperbarui.');
            }}
          />
        ) : null}
      </section>

      <nav className="bottom-nav" aria-label="Navigasi utama mobile">
        {allowedNavItems.map(({ id, label, icon: Icon }) => (
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
  user,
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
  user: AdminUser;
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
  const accountIncome = Math.round(totalIncome * (user.revenueSharePercent ?? 0) / 100);

  return (
    <>
      {/* ── Hero ── */}
      <motion.section className="db-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="db-hero-left">
          <p className="db-hero-eyebrow">Total saldo masuk</p>
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
          <div className="db-stat">
            <WalletCards size={18} />
            <strong>{formatCurrency(accountIncome)}</strong>
            <span>Bagian Anda {user.revenueSharePercent ?? 0}%</span>
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
  const breakdown = source.breakdown;

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

      {breakdown ? (
        <>
          <div className="db-breakdown-grid">
            <div className="db-breakdown-cell">
              <span className="db-breakdown-label">Admin Fee</span>
              <strong>{formatCurrency(breakdown.adminFee)}</strong>
            </div>
            <div className="db-breakdown-cell">
              <span className="db-breakdown-label">
                Bagi Hasil
                {breakdown.sharePercent?.effective != null
                  ? ` ${breakdown.sharePercent.effective.toFixed(1)}%`
                  : breakdown.sharePercent?.average != null
                    ? ` ~${breakdown.sharePercent.average.toFixed(1)}%`
                    : ''}
              </span>
              <strong>{formatCurrency(breakdown.platformShare)}</strong>
            </div>
            <div className="db-breakdown-cell">
              <span className="db-breakdown-label">Paket Event</span>
              <strong>{formatCurrency(breakdown.packagePayments)}</strong>
            </div>
            {breakdown.qrisFee && breakdown.qrisFee > 0 ? (
              <div className="db-breakdown-cell">
                <span className="db-breakdown-label">QRIS Fee</span>
                <strong>{formatCurrency(breakdown.qrisFee)}</strong>
              </div>
            ) : null}
          </div>
          <p className="db-breakdown-formula">
            Saldo = Admin Fee + Bagi Hasil + Paket Event
            {breakdown.sharePercent?.min != null && breakdown.sharePercent.max != null
              && breakdown.sharePercent.min !== breakdown.sharePercent.max
              ? ` · % bagi hasil ${breakdown.sharePercent.min.toFixed(1)}–${breakdown.sharePercent.max.toFixed(1)}%`
              : ''}
          </p>
          {breakdown.revenueShareBalances ? (
            <div className="db-panitia-balance">
              <p className="db-breakdown-formula">
                Saldo bagi hasil panitia (lifetime)
              </p>
              <div className="db-breakdown-grid">
                <div className="db-breakdown-cell">
                  <span className="db-breakdown-label">Aktif</span>
                  <strong>{formatCurrency(breakdown.revenueShareBalances.summary.activeBalance)}</strong>
                </div>
                <div className="db-breakdown-cell">
                  <span className="db-breakdown-label">Pending</span>
                  <strong>{formatCurrency(breakdown.revenueShareBalances.summary.totalPending)}</strong>
                </div>
                <div className="db-breakdown-cell">
                  <span className="db-breakdown-label">Sudah Cair</span>
                  <strong>{formatCurrency(breakdown.revenueShareBalances.summary.totalWithdrawn)}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

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

type TransactionPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';
type TransactionGroupBy = 'day' | 'week' | 'month';
type TransactionStatus = Transaction['status'];

const PERIOD_OPTIONS: Array<{ id: TransactionPeriod; label: string }> = [
  { id: 'all', label: 'Semua waktu' },
  { id: 'today', label: 'Hari ini' },
  { id: 'week', label: 'Minggu ini' },
  { id: 'month', label: 'Bulan ini' },
  { id: 'custom', label: 'Kustom' },
];

const GROUP_BY_OPTIONS: Array<{ id: TransactionGroupBy; label: string }> = [
  { id: 'day', label: 'Per hari' },
  { id: 'week', label: 'Per minggu' },
  { id: 'month', label: 'Per bulan' },
];

const STATUS_OPTIONS: TransactionStatus[] = ['Terverifikasi', 'Review', 'Terjadwal'];

type ParsedEvent = {
  event: string;
  type: string;
  quantity: number;
  unit: string;
};

const parseEventInfo = (description: string): ParsedEvent | null => {
  if (!description) return null;
  const cleaned = description.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^(?:admin\s+fee\s+)?(\S+)\s+(.+?)\s*\((\d+)\s*([^)]+)\)\s*$/i);
  if (!match) return null;
  return {
    type: match[1].toLowerCase(),
    event: match[2].trim(),
    quantity: Number(match[3]) || 0,
    unit: match[4].trim().toLowerCase(),
  };
};

const isSyncSnapshot = (transaction: Transaction) =>
  /^saldo\s+api\b/i.test(transaction.description?.trim() ?? '');

const isoWeekKey = (date: Date) => {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.getTime();
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const yearStartDay = (yearStart.getDay() + 6) % 7;
  yearStart.setDate(yearStart.getDate() + ((4 - yearStartDay) + 7) % 7);
  const week = 1 + Math.round((firstThursday - yearStart.getTime()) / 604800000);
  return { year: target.getFullYear(), week };
};

const startOfWeek = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNr = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - dayNr);
  return result;
};

function TransactionsView({
  sources,
  transactions,
  user,
  onExportTransactions,
  onRefreshTransactions,
}: {
  sources: RevenueSource[];
  transactions: Transaction[];
  user: AdminUser;
  onExportTransactions: () => void;
  onRefreshTransactions: () => void;
}) {
  const sharePercent = user.revenueSharePercent ?? 0;
  const shareRatio = sharePercent / 100;
  const isShareMode = sharePercent > 0;
  const shareAmount = (value: number) => (isShareMode ? Math.round(value * shareRatio) : value);

  const availableSources = useMemo(
    () => (isShareMode ? sources.filter((source) => source.id === 'simpaskor') : sources),
    [sources, isShareMode],
  );
  const scopedTransactions = useMemo(() => {
    const cleaned = transactions.filter((tx) => !isSyncSnapshot(tx));
    return isShareMode ? cleaned.filter((tx) => tx.sourceId === 'simpaskor') : cleaned;
  }, [transactions, isShareMode]);

  const [period, setPeriod] = useState<TransactionPeriod>('all');
  const [groupBy, setGroupBy] = useState<TransactionGroupBy>('day');
  const [selectedSources, setSelectedSources] = useState<SourceId[]>(() => (isShareMode ? ['simpaskor'] : []));
  const [selectedStatuses, setSelectedStatuses] = useState<TransactionStatus[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (isShareMode) {
      setSelectedSources((prev) => (prev.length === 1 && prev[0] === 'simpaskor' ? prev : ['simpaskor']));
    }
  }, [isShareMode]);

  const computedRange = useMemo<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    if (period === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start.getTime() + 86_400_000);
      return { from: start, to: end };
    }
    if (period === 'week') {
      const start = startOfWeek(now);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { from: start, to: end };
    }
    if (period === 'month') {
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    }
    if (period === 'custom') {
      return {
        from: dateFrom ? new Date(`${dateFrom}T00:00:00`) : null,
        to: dateTo ? new Date(`${dateTo}T23:59:59.999`) : null,
      };
    }
    return { from: null, to: null };
  }, [period, dateFrom, dateTo]);

  const parsedMin = minAmount === '' ? null : Number(minAmount);
  const parsedMax = maxAmount === '' ? null : Number(maxAmount);

  const filtered = useMemo(() => {
    return scopedTransactions.filter((tx) => {
      const date = new Date(tx.date);
      if (computedRange.from && date < computedRange.from) return false;
      if (computedRange.to && date > computedRange.to) return false;
      if (selectedSources.length && !selectedSources.includes(tx.sourceId)) return false;
      if (selectedStatuses.length && !selectedStatuses.includes(tx.status)) return false;
      if (parsedMin != null && !Number.isNaN(parsedMin) && tx.amount < parsedMin) return false;
      if (parsedMax != null && !Number.isNaN(parsedMax) && tx.amount > parsedMax) return false;
      return true;
    });
  }, [scopedTransactions, computedRange, selectedSources, selectedStatuses, parsedMin, parsedMax]);

  const totalAmountRaw = filtered.reduce((sum, tx) => sum + tx.amount, 0);
  const totalAmount = shareAmount(totalAmountRaw);
  const verifiedFiltered = filtered.filter((tx) => tx.status === 'Terverifikasi').length;
  const averageAmount = filtered.length ? Math.round(totalAmount / filtered.length) : 0;

  const perEventGroups = useMemo(() => {
    return availableSources
      .map((source) => {
        const txs = filtered.filter((tx) => tx.sourceId === source.id);
        const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
        return { source, transactions: txs, total };
      })
      .filter((group) => group.transactions.length > 0 || selectedSources.includes(group.source.id));
  }, [availableSources, filtered, selectedSources]);

  const eventBreakdown = useMemo(() => {
    type TypeStat = { type: string; total: number; count: number; quantity: number; unit: string };
    type EventStat = {
      event: string;
      total: number;
      count: number;
      quantity: number;
      types: Map<string, TypeStat>;
      transactions: Transaction[];
    };
    const map = new Map<string, EventStat>();

    for (const tx of filtered.filter((t) => t.sourceId === 'simpaskor')) {
      const info = parseEventInfo(tx.description);
      const key = info?.event ?? (tx.description?.trim() || 'Lainnya');
      const entry = map.get(key) ?? {
        event: key,
        total: 0,
        count: 0,
        quantity: 0,
        types: new Map<string, TypeStat>(),
        transactions: [],
      };
      entry.total += tx.amount;
      entry.count += 1;
      entry.transactions.push(tx);
      if (info) {
        entry.quantity += info.quantity;
        const typeEntry = entry.types.get(info.type) ?? { type: info.type, total: 0, count: 0, quantity: 0, unit: info.unit };
        typeEntry.total += tx.amount;
        typeEntry.count += 1;
        typeEntry.quantity += info.quantity;
        typeEntry.unit = info.unit;
        entry.types.set(info.type, typeEntry);
      }
      map.set(key, entry);
    }

    return Array.from(map.values())
      .map((entry) => ({ ...entry, types: Array.from(entry.types.values()).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const periodGroups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sortKey: number; total: number; count: number; transactions: Transaction[] }>();

    for (const tx of filtered) {
      const date = new Date(tx.date);
      if (Number.isNaN(date.getTime())) continue;
      let key: string;
      let label: string;
      let sortKey: number;
      if (groupBy === 'day') {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        key = dayStart.toISOString().slice(0, 10);
        label = dayStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        sortKey = dayStart.getTime();
      } else if (groupBy === 'week') {
        const { year, week } = isoWeekKey(date);
        const weekStart = startOfWeek(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        key = `${year}-W${String(week).padStart(2, '0')}`;
        label = `Minggu ${week} - ${weekStart.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} s/d ${weekEnd.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        sortKey = weekStart.getTime();
      } else {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        label = monthStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        sortKey = monthStart.getTime();
      }

      const entry = map.get(key) ?? { key, label, sortKey, total: 0, count: 0, transactions: [] };
      entry.total += tx.amount;
      entry.count += 1;
      entry.transactions.push(tx);
      map.set(key, entry);
    }

    return Array.from(map.values()).sort((a, b) => b.sortKey - a.sortKey);
  }, [filtered, groupBy]);

  const toggleSource = (id: SourceId) => {
    setSelectedSources((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };
  const toggleStatus = (status: TransactionStatus) => {
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status]));
  };

  const hasActiveFilters =
    period !== 'all'
    || (!isShareMode && selectedSources.length > 0)
    || selectedStatuses.length > 0
    || minAmount !== ''
    || maxAmount !== '';

  const resetFilters = () => {
    setPeriod('all');
    setSelectedSources(isShareMode ? ['simpaskor'] : []);
    setSelectedStatuses([]);
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <section className="transactions-page">
      <article className="panel transaction-filter-panel">
        <PanelTitle
          eyebrow="Filter"
          title="Filter Transaksi"
          action={
            <div className="transaction-actions">
              {hasActiveFilters ? (
                <button className="ghost-button" onClick={resetFilters}>
                  <X size={17} />
                  Reset filter
                </button>
              ) : null}
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

        {isShareMode ? (
          <div className="share-mode-banner">
            <WalletCards size={18} />
            <div>
              <strong>Bagian Anda: {sharePercent}% dari Simpaskor</strong>
              <span>Tampilan dikunci ke transaksi Simpaskor. Semua nominal sudah dihitung sebagai bagian Anda.</span>
            </div>
          </div>
        ) : null}

        <div className="filter-row">
          <span className="filter-label">Periode</span>
          <div className="filter-chips">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`filter-chip ${period === option.id ? 'active' : ''}`}
                onClick={() => setPeriod(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' ? (
          <div className="filter-row filter-row-grid">
            <label className="filter-field">
              <span>Dari tanggal</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="filter-field">
              <span>Sampai tanggal</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>
        ) : null}

        <div className="filter-row">
          <span className="filter-label">Event / Sumber{isShareMode ? ' (terkunci)' : ''}</span>
          <div className="filter-chips">
            {availableSources.map((source) => {
              const active = selectedSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  className={`filter-chip ${active ? 'active' : ''} ${isShareMode ? 'locked' : ''}`}
                  onClick={() => !isShareMode && toggleSource(source.id)}
                  style={active ? { borderColor: source.color, color: source.color } : undefined}
                  type="button"
                  disabled={isShareMode}
                  aria-disabled={isShareMode}
                >
                  <span className="source-dot" style={{ backgroundColor: source.color }} />
                  {source.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">Status</span>
          <div className="filter-chips">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                className={`filter-chip ${selectedStatuses.includes(status) ? 'active' : ''}`}
                onClick={() => toggleStatus(status)}
                type="button"
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row filter-row-grid">
          <label className="filter-field">
            <span>Nominal minimum (Rp)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              min={0}
              value={minAmount}
              onChange={(event) => setMinAmount(event.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Nominal maksimum (Rp)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Tanpa batas"
              min={0}
              value={maxAmount}
              onChange={(event) => setMaxAmount(event.target.value)}
            />
          </label>
        </div>

        <div className="filter-row">
          <span className="filter-label">Kelompokkan</span>
          <div className="filter-chips">
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`filter-chip ${groupBy === option.id ? 'active' : ''}`}
                onClick={() => setGroupBy(option.id)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </article>

      <article className="panel transaction-overview">
        <PanelTitle
          eyebrow={isShareMode ? `Ringkasan bagian Anda (${sharePercent}%)` : 'Ringkasan'}
          title={hasActiveFilters ? 'Ringkasan sesuai filter' : 'Ringkasan transaksi'}
        />
        <div className="transaction-overview-grid">
          <div>
            <span>{isShareMode ? `Bagian Anda (${sharePercent}%)` : 'Total nominal'}</span>
            <strong>{formatCurrency(totalAmount)}</strong>
            {isShareMode ? <small className="overview-sub">dari {formatCurrency(totalAmountRaw)}</small> : null}
          </div>
          <div>
            <span>Jumlah transaksi</span>
            <strong>{filtered.length}</strong>
          </div>
          <div>
            <span>Terverifikasi</span>
            <strong>{verifiedFiltered}</strong>
          </div>
          <div>
            <span>Rata-rata nominal</span>
            <strong>{formatCurrency(averageAmount)}</strong>
          </div>
        </div>
      </article>

      {filtered.length === 0 ? (
        <article className="panel">
          <EmptyState
            icon={BadgeCheck}
            title="Tidak ada transaksi yang cocok dengan filter."
            note="Sesuaikan periode, sumber, status, atau rentang nominal untuk melihat data."
          />
        </article>
      ) : (
        <>
          <div className="transaction-detail-grid">
            {perEventGroups.map((group) => (
              <TransactionEventPanel
                key={group.source.id}
                source={group.source}
                total={group.total}
                transactions={group.transactions}
                shareRatio={shareRatio}
                isShareMode={isShareMode}
              />
            ))}
          </div>

          {eventBreakdown.length > 0 ? (
            <article className="panel">
              <PanelTitle
                eyebrow={isShareMode ? `Per event (${sharePercent}% Simpaskor)` : 'Per event'}
                title="Rekap admin fee Simpaskor per event"
              />
              <div className="event-breakdown-list">
                {eventBreakdown.map((entry) => (
                  <EventBreakdownCard
                    key={entry.event}
                    event={entry.event}
                    total={entry.total}
                    count={entry.count}
                    quantity={entry.quantity}
                    types={entry.types}
                    transactions={entry.transactions}
                    shareRatio={shareRatio}
                    isShareMode={isShareMode}
                  />
                ))}
              </div>
            </article>
          ) : null}

          <article className="panel">
            <PanelTitle
              eyebrow={isShareMode ? `Per periode (${sharePercent}% Simpaskor)` : 'Per periode'}
              title={
                groupBy === 'day' ? 'Rekap per hari' : groupBy === 'week' ? 'Rekap per minggu' : 'Rekap per bulan'
              }
            />
            <div className="period-group-list">
              {periodGroups.map((group) => (
                <PeriodGroupCard
                  key={group.key}
                  label={group.label}
                  total={group.total}
                  count={group.count}
                  transactions={group.transactions}
                  shareRatio={shareRatio}
                  isShareMode={isShareMode}
                />
              ))}
            </div>
          </article>
        </>
      )}
    </section>
  );
}

function TransactionEventPanel({
  source,
  total,
  transactions,
  shareRatio,
  isShareMode,
}: {
  source: RevenueSource;
  total: number;
  transactions: Transaction[];
  shareRatio: number;
  isShareMode: boolean;
}) {
  const displayedTotal = isShareMode ? Math.round(total * shareRatio) : total;
  return (
    <article className="panel transaction-detail-panel">
      <div className="transaction-detail-head">
        <div>
          <span className="source-dot" style={{ backgroundColor: source.color }} />
          <p className="eyebrow">{source.id}</p>
          <h2>{source.name}</h2>
        </div>
        <div>
          <strong>{formatCurrency(displayedTotal)}</strong>
          <span>
            {transactions.length} transaksi
            {isShareMode ? ` - bagian dari ${formatCurrency(total)}` : ''}
          </span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState icon={BadgeCheck} title="Belum ada transaksi untuk sumber ini." note="Data akan muncul setelah transaksi cocok dengan filter." />
      ) : (
        <div className="table-wrap detail-table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Keterangan</th>
                <th>{isShareMode ? 'Bagian Anda' : 'Nominal'}</th>
                <th>Tanggal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const shareValue = isShareMode ? Math.round(transaction.amount * shareRatio) : transaction.amount;
                return (
                  <tr key={`${source.id}-${transaction.id}`}>
                    <td className="detail-order-id">{transaction.id}</td>
                    <td>
                      <div className="detail-cell-title">{transaction.description}</div>
                      <div className="detail-cell-sub">{transaction.source}</div>
                    </td>
                    <td>
                      <div>{formatCurrency(shareValue)}</div>
                      {isShareMode ? <small className="detail-cell-sub">dari {formatCurrency(transaction.amount)}</small> : null}
                    </td>
                    <td>{formatDate(transaction.date)}</td>
                    <td><span className={`transaction-status ${transaction.status.toLowerCase()}`}>{transaction.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function PeriodGroupCard({
  label,
  total,
  count,
  transactions,
  shareRatio,
  isShareMode,
}: {
  label: string;
  total: number;
  count: number;
  transactions: Transaction[];
  shareRatio: number;
  isShareMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayedTotal = isShareMode ? Math.round(total * shareRatio) : total;
  return (
    <div className={`period-group-card ${expanded ? 'expanded' : ''}`}>
      <button
        className="period-group-header"
        onClick={() => setExpanded((value) => !value)}
        type="button"
        aria-expanded={expanded}
      >
        <div>
          <strong>{label}</strong>
          <span>
            {count} transaksi
            {isShareMode ? ` - dari ${formatCurrency(total)}` : ''}
          </span>
        </div>
        <div>
          <b>{formatCurrency(displayedTotal)}</b>
          <span>{expanded ? 'Sembunyikan' : 'Lihat detail'}</span>
        </div>
      </button>
      {expanded ? (
        <div className="period-group-body">
          {transactions.map((transaction) => (
            <TransactionRow
              key={`${transaction.id}-${transaction.date}`}
              transaction={transaction}
              shareRatio={shareRatio}
              isShareMode={isShareMode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EventBreakdownCard({
  event,
  total,
  count,
  quantity,
  types,
  transactions,
  shareRatio,
  isShareMode,
}: {
  event: string;
  total: number;
  count: number;
  quantity: number;
  types: Array<{ type: string; total: number; count: number; quantity: number; unit: string }>;
  transactions: Transaction[];
  shareRatio: number;
  isShareMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayedTotal = isShareMode ? Math.round(total * shareRatio) : total;
  return (
    <div className={`event-breakdown-card ${expanded ? 'expanded' : ''}`}>
      <button
        className="event-breakdown-header"
        onClick={() => setExpanded((value) => !value)}
        type="button"
        aria-expanded={expanded}
      >
        <div className="event-breakdown-title">
          <strong>{event}</strong>
          <span>
            {count} transaksi
            {quantity > 0 ? ` - ${quantity} unit` : ''}
            {isShareMode ? ` - dari ${formatCurrency(total)}` : ''}
          </span>
        </div>
        <div className="event-breakdown-amount">
          <b>{formatCurrency(displayedTotal)}</b>
          <span>{expanded ? 'Sembunyikan' : 'Lihat detail'}</span>
        </div>
      </button>

      {types.length > 0 ? (
        <div className="event-type-chips">
          {types.map((type) => {
            const displayed = isShareMode ? Math.round(type.total * shareRatio) : type.total;
            return (
              <span className="event-type-chip" key={type.type}>
                <b>{type.type}</b>
                <span>{type.count} tx - {type.quantity} {type.unit}</span>
                <strong>{formatCurrency(displayed)}</strong>
              </span>
            );
          })}
        </div>
      ) : null}

      {expanded ? (
        <div className="event-breakdown-body">
          {transactions.map((transaction) => (
            <TransactionRow
              key={`${transaction.id}-${transaction.date}`}
              transaction={transaction}
              shareRatio={shareRatio}
              isShareMode={isShareMode}
            />
          ))}
        </div>
      ) : null}
    </div>
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
            Excel sumber
          </button>
          <button className="ghost-button" onClick={onExportTransactions}>
            <Download size={18} />
            Excel transaksi
          </button>
        </div>
      </article>
    </section>
  );
}

function AccountsView({
  accessData,
  isLoading,
  onReload,
  onSave,
  onUpdate,
}: {
  accessData: AccessPayload | null;
  isLoading: boolean;
  onReload: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (accountId: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const permissionCatalog = accessData?.permissionCatalog ?? [];
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'admin',
    revenueSharePercent: 0,
    permissions: ['finance.dashboard'],
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      await onSave(form);
      setForm({ name: '', username: '', email: '', password: '', role: 'admin', revenueSharePercent: 0, permissions: ['finance.dashboard'] });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Akun gagal dibuat.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="management-grid">
      <form className="panel management-form" onSubmit={submit}>
        <PanelTitle eyebrow="Akses" title="Buat akun baru" />
        <div className="form-grid">
          <label className="form-field">
            <span>Nama</span>
            <div><UserRound size={18} /><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
          </label>
          <label className="form-field">
            <span>Username</span>
            <div><ShieldCheck size={18} /><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="contoh: akun-a" required /></div>
          </label>
          <label className="form-field">
            <span>Email opsional</span>
            <div><Mail size={18} /><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          </label>
          <label className="form-field">
            <span>Password</span>
            <div><LockKeyhole size={18} /><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={8} required /></div>
          </label>
          <label className="form-field">
            <span>Role</span>
            <div><Layers3 size={18} /><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></div>
          </label>
          <label className="form-field">
            <span>Persentase</span>
            <div><WalletCards size={18} /><input type="number" min="0" max="100" step="0.01" value={form.revenueSharePercent} onChange={(event) => setForm({ ...form, revenueSharePercent: Number(event.target.value) })} /></div>
          </label>
        </div>
        <PermissionChecklist catalog={permissionCatalog} selected={form.permissions} onToggle={togglePermission} />
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-button" disabled={isSaving || isLoading}>
          {isSaving ? <Loader2 size={18} className="spin-icon" /> : <ShieldCheck size={18} />}
          Buat akun
        </button>
      </form>

      <section className="panel">
        <PanelTitle
          eyebrow="Akun"
          title="Role dan permission"
          action={<button className="ghost-button" onClick={onReload} disabled={isLoading}>{isLoading ? 'Memuat...' : 'Refresh'}</button>}
        />
        <div className="management-list">
          {(accessData?.users ?? []).map((account) => (
            <AccountEditor key={account.id} account={account} catalog={permissionCatalog} onUpdate={onUpdate} />
          ))}
        </div>
      </section>
    </section>
  );
}

function PermissionChecklist({
  catalog,
  selected,
  onToggle,
}: {
  catalog: PermissionCatalogItem[];
  selected: string[];
  onToggle: (permission: string) => void;
}) {
  return (
    <div className="permission-grid">
      {catalog.map((permission) => (
        <label key={permission.id} className="permission-item">
          <input type="checkbox" checked={selected.includes(permission.id)} onChange={() => onToggle(permission.id)} />
          <span>{permission.label}</span>
        </label>
      ))}
    </div>
  );
}

function AccountEditor({
  account,
  catalog,
  onUpdate,
}: {
  account: ManagedUser;
  catalog: PermissionCatalogItem[];
  onUpdate: (accountId: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    name: account.name,
    username: account.username,
    email: account.email ?? '',
    role: account.role,
    isActive: account.isActive,
    password: '',
    revenueSharePercent: account.revenueSharePercent,
    permissions: account.permissions,
  });
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const togglePermission = (permission: string) => {
    setDraft((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  };

  const save = async () => {
    setError('');
    setIsSaving(true);
    try {
      await onUpdate(account.id, draft);
      setDraft((current) => ({ ...current, password: '' }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Akun gagal diperbarui.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="account-card">
      <div className="account-card-head">
        <div>
          <strong>{account.name}</strong>
          <span>@{account.username} · {account.role}</span>
        </div>
        <span className={account.isActive ? 'status-pill success' : 'status-pill neutral'}>{account.isActive ? 'Aktif' : 'Nonaktif'}</span>
      </div>
      <div className="form-grid compact">
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Nama" />
        <input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} aria-label="Username" />
        <input value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} aria-label="Role" disabled={account.role === 'serigala'} />
        <input type="password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Password baru opsional" aria-label="Password baru" />
      </div>
      <label className="toggle-row">
        <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} disabled={account.role === 'serigala'} />
        Akun aktif
      </label>
      <PermissionChecklist catalog={catalog} selected={draft.permissions} onToggle={togglePermission} />
      {error ? <div className="form-error">{error}</div> : null}
      <button className="ghost-button" onClick={save} disabled={isSaving}>
        {isSaving ? <Loader2 size={17} className="spin-icon" /> : <CheckCircle2 size={17} />}
        Simpan akses
      </button>
    </article>
  );
}

function RevenueSharesView({
  accessData,
  isLoading,
  onReload,
  onUpdate,
}: {
  accessData: AccessPayload | null;
  isLoading: boolean;
  onReload: () => void;
  onUpdate: (accountId: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <section className="panel">
      <PanelTitle
        eyebrow="Pembagian"
        title="Persentase pendapatan"
        action={<button className="ghost-button" onClick={onReload} disabled={isLoading}>{isLoading ? 'Memuat...' : 'Refresh'}</button>}
      />
      <div className="share-summary">
        <span>Total pendapatan</span>
        <strong>{formatCurrency(accessData?.totalIncome ?? 0)}</strong>
      </div>
      <div className="management-list">
        {(accessData?.users ?? []).map((account) => (
          <RevenueShareEditor key={account.id} account={account} totalIncome={accessData?.totalIncome ?? 0} onUpdate={onUpdate} />
        ))}
      </div>
    </section>
  );
}

function RevenueShareEditor({
  account,
  totalIncome,
  onUpdate,
}: {
  account: ManagedUser;
  totalIncome: number;
  onUpdate: (accountId: number, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [percentage, setPercentage] = useState(account.revenueSharePercent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const amount = Math.round(totalIncome * percentage / 100);

  const save = async () => {
    setError('');
    setIsSaving(true);
    try {
      await onUpdate(account.id, { revenueSharePercent: percentage, permissions: account.permissions, role: account.role });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Persentase gagal disimpan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="share-card">
      <div>
        <strong>{account.name}</strong>
        <span>@{account.username}</span>
      </div>
      <label>
        <span>Persentase</span>
        <input type="number" min="0" max="100" step="0.01" value={percentage} onChange={(event) => setPercentage(Number(event.target.value))} />
      </label>
      <div>
        <span>Hasil</span>
        <strong>{formatCurrency(amount)}</strong>
      </div>
      {error ? <div className="form-error">{error}</div> : null}
      <button className="ghost-button" onClick={save} disabled={isSaving}>
        {isSaving ? <Loader2 size={17} className="spin-icon" /> : <CheckCircle2 size={17} />}
        Simpan
      </button>
    </article>
  );
}

function LoginView({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('serigala');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await onLogin(username, password);
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
          <span>Username</span>
          <div>
            <UserRound size={18} />
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="serigala"
              autoComplete="username"
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

function TransactionRow({
  showSource = true,
  transaction,
  shareRatio = 0,
  isShareMode = false,
}: {
  showSource?: boolean;
  transaction: Transaction;
  shareRatio?: number;
  isShareMode?: boolean;
}) {
  const shareValue = isShareMode ? Math.round(transaction.amount * shareRatio) : transaction.amount;
  return (
    <div className="transaction-row">
      <div>
        {showSource ? <strong>{transaction.source}</strong> : null}
        <span>{transaction.id} - {transaction.description}</span>
      </div>
      <div>
        <b>{formatCurrency(shareValue)}</b>
        {isShareMode ? <span>dari {formatCurrency(transaction.amount)}</span> : null}
        <span>{new Date(transaction.date).toLocaleString('id-ID')}</span>
      </div>
      <span className={`transaction-status ${transaction.status.toLowerCase()}`}>{transaction.status}</span>
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
