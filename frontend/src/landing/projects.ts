import vertinovaLogo from '../../logo-vertinova.png';

export const COMPANY = {
  name: 'Vertinova',
  tagline: 'Partner teknologi untuk instansi, bisnis, dan komunitas',
  intro:
    'Vertinova membangun aplikasi web, sistem informasi, dan integrasi yang dipakai setiap hari: oleh dinas pemerintahan, perusahaan, UMKM, sampai penyelenggara kejuaraan nasional. Kami senang menyederhanakan proses yang rumit, dan tetap mendampingi setelah aplikasinya rilis.',
  email: 'vertinovagroup@gmail.com',
  whatsapp: '', // TODO: isi nomor WhatsApp format internasional tanpa "+", mis. "6281234567890". Kosong = tombol disembunyikan.
  logo: vertinovaLogo,
  strengths: [
    { title: 'Sudah dipakai di lapangan', text: 'Dari presensi pegawai, data ratusan desa, sampai pesanan kopi — semuanya berjalan setiap hari, bukan sekadar demo.' },
    { title: 'Bicara apa adanya', text: 'Kami jelaskan apa yang bisa, berapa lama, dan apa risikonya sejak awal. Tanpa istilah yang bikin bingung.' },
    { title: 'Rapi & aman', text: 'Hak akses per peran, data terlindungi, dan server yang dipantau.' },
    { title: 'Tetap ada setelah rilis', text: 'Pelatihan pengguna, perbaikan, dan pengembangan lanjutan saat kebutuhan Anda tumbuh.' },
  ],
  services: ['Aplikasi web & mobile', 'Sistem informasi instansi', 'Website & pemesanan online', 'Dashboard & data', 'Integrasi API & pembayaran', 'Cloud & server'],
};

export type Project = {
  id: string;
  name: string;
  fullName: string;
  category: string;
  client: string;
  url?: string;
  description: string;
  features: string[];
  users?: string;
  images: { src: string; alt: string }[];
  billboard?: string;
  color: string;
};

export const PROJECTS: Project[] = [
  {
    id: 'simpaskor',
    name: 'Simpaskor',
    fullName: 'Simpaskor — Sistem Paskibra Skor',
    category: 'Platform kompetisi nasional',
    client: 'Komunitas & penyelenggara lomba Paskibra se-Indonesia',
    url: 'https://simpaskor.id',
    description:
      'Solusi all-in-one untuk transformasi digital kompetisi Paskibra se-Indonesia. Rekap nilai juri, tiket, hingga voting peserta favorit berjalan real-time dalam satu platform — tidak ada lagi rekap manual di kertas.',
    features: [
      'Penilaian juri & rekap nilai real-time',
      'Tiket digital untuk penonton event',
      'Voting tim & peserta favorit',
      'Pendaftaran dan pengelolaan event oleh panitia',
      'Paket layanan untuk penyelenggara',
      'Berita, pengumuman, dan hasil lomba',
    ],
    users: 'Panitia, juri, pelatih, peserta, dan penonton',
    images: [
      { src: '/projects/simpaskor/screenshot.webp', alt: 'Halaman utama Simpaskor' },
      { src: '/projects/simpaskor/simpaskor.png', alt: 'Logo Simpaskor' },
      { src: '/projects/simpaskor/orang1.webp', alt: 'Anggota Paskibra di halaman Simpaskor' },
      { src: '/projects/simpaskor/orang4.webp', alt: 'Peserta lomba Paskibra' },
    ],
    billboard: '/projects/simpaskor/screenshot.webp',
    color: '#ef4444',
  },
  {
    id: 'dpmd',
    name: 'DPMD Kabupaten Bogor',
    fullName: 'Sistem Informasi Dinas Pemberdayaan Masyarakat dan Desa Kabupaten Bogor',
    category: 'Sistem informasi pemerintahan',
    client: 'Dinas Pemberdayaan Masyarakat dan Desa (DPMD) Kabupaten Bogor',
    url: 'https://dpmd.bogorkab.go.id',
    description:
      'Membangun Bogor dari desa. Sistem informasi untuk 416 desa dan 19 kelurahan di 40 kecamatan: data aparatur, kelembagaan, BUMDes, sampai bantuan keuangan dikelola di satu tempat.',
    features: [
      'Peta interaktif 40 kecamatan, 416 desa & 19 kelurahan',
      'Data aparatur, kelembagaan, dan BUMDes',
      'Dashboard publik bantuan keuangan desa',
      'Alur verifikasi proposal desa per tahap',
      'Akun terpisah untuk DPMD, kecamatan, desa, dan dinas terkait',
      'Asisten "Tanya DPMD", kantor 3D, dan bisa dipasang sebagai aplikasi',
    ],
    users: 'Pegawai DPMD, kecamatan, pemerintah desa, dan masyarakat',
    images: [
      { src: '/projects/dpmd/screenshot.webp', alt: 'Halaman utama DPMD Kabupaten Bogor dengan peta desa' },
      { src: '/projects/dpmd/logo-dpmd-192.png', alt: 'Logo DPMD Kabupaten Bogor' },
    ],
    billboard: '/projects/dpmd/screenshot.webp',
    color: '#f59e0b',
  },
  {
    id: 'forbasi',
    name: 'FORBASI',
    fullName: 'FORBASI — Forum Baris Indonesia',
    category: 'Organisasi & kejuaraan nasional',
    client: 'Forum Baris Indonesia (FORBASI)',
    url: 'https://forbasi.or.id',
    description:
      'Rumah digital FORBASI dan Kejuaraan Nasional baris-berbaris. Tim bisa memantau jadwal dan kategori lomba serta memesan semua kebutuhan tim di satu tempat.',
    features: [
      'Jadwal & kategori lomba Kejurnas',
      'Pemesanan kebutuhan tim di satu tempat',
      'Hitung mundur dan info event terdekat',
      'Jelajah venue dalam 3D',
      'Asisten "Tanya FORBASI" seputar KTA, Kejurnas, dan lisensi',
    ],
    users: 'Pengurus, pelatih, tim, dan peserta baris-berbaris',
    images: [{ src: '/projects/forbasi/screenshot.webp', alt: 'Halaman Kejurnas FORBASI' }],
    billboard: '/projects/forbasi/screenshot.webp',
    color: '#16a34a',
  },
  {
    id: 'dp3ap2kb',
    name: 'DP3AP2KB Presensi',
    fullName: 'DP3AP2KB Presensi — Dinas Pemberdayaan Perempuan dan Perlindungan Anak, Pengendalian Penduduk dan Keluarga Berencana Kabupaten Bogor',
    category: 'Aplikasi presensi pegawai',
    client: 'DP3AP2KB Kabupaten Bogor',
    url: 'https://kb.vertinova.id',
    description:
      'Aplikasi resmi presensi pegawai DP3AP2KB Kabupaten Bogor. Dipasang langsung di perangkat sebagai aplikasi, dan login hanya dibuka dari aplikasi yang sudah terpasang.',
    features: [
      'Presensi pegawai dari perangkat masing-masing',
      'Terpasang sebagai aplikasi (PWA)',
      'Login hanya dari aplikasi yang terpasang',
      'Khusus pegawai wilayah Kabupaten Bogor',
    ],
    users: 'Pegawai DP3AP2KB Kabupaten Bogor',
    images: [{ src: '/projects/dp3ap2kb/screenshot.webp', alt: 'Halaman DP3AP2KB Presensi' }],
    billboard: '/projects/dp3ap2kb/screenshot.webp',
    color: '#ec4899',
  },
  {
    id: 'aksara',
    name: 'AKSARA',
    fullName: 'AKSARA — Sekretariat DPRD Kabupaten Bogor',
    category: 'Sistem perjalanan dinas',
    client: 'Sekretariat DPRD Kabupaten Bogor',
    url: 'https://aksara.vertinova.id',
    description:
      'Perjalanan dinas lebih terarah. AKSARA menata perjalanan dinas dari perencanaan hingga penyelesaian, untuk mempercepat serapan dan realisasi anggaran.',
    features: [
      'Alur kerja: rencanakan, ajukan, berangkat, selesaikan',
      'Akses sesuai kewenangan',
      'Peta rute perjalanan dinas',
      'Mendukung percepatan serapan & realisasi anggaran',
    ],
    users: 'Pegawai dan pimpinan Sekretariat DPRD',
    images: [{ src: '/projects/aksara/screenshot.webp', alt: 'Halaman utama AKSARA Sekretariat DPRD' }],
    billboard: '/projects/aksara/screenshot.webp',
    color: '#4f46e5',
  },
  {
    id: 'sire',
    name: 'Sire Coffee',
    fullName: 'Sire Coffee — website & pemesanan online',
    category: 'Website & pemesanan online F&B',
    client: 'Sire Coffee',
    url: 'https://sire.vertinova.id',
    description:
      'Rumah online untuk kedai "kopi jujur, diseduh pelan-pelan". Pelanggan melihat menu dan jam buka secara langsung, lalu memesan untuk pickup, makan di tempat, atau delivery.',
    features: [
      'Pesan online: pickup, makan di tempat, atau delivery',
      'Menu lengkap dengan harga',
      'Status buka/tutup & jam operasional real-time',
      'Pesan via WhatsApp',
      'Halaman cerita dan lokasi kedai',
    ],
    users: 'Pelanggan dan tim kedai Sire Coffee',
    images: [{ src: '/projects/sire/screenshot.webp', alt: 'Halaman utama Sire Coffee' }],
    billboard: '/projects/sire/screenshot.webp',
    color: '#1f6f4a',
  },
];

export const projectById = (id: string) => PROJECTS.find((p) => p.id === id);

export const mailtoLink = (subject: string, body = '') =>
  `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

export const whatsappLink = (text: string) =>
  COMPANY.whatsapp ? `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent(text)}` : '';
