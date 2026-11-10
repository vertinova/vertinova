// Demo content for a fictional spice company ("Arunika Rempah"). Names, numbers and specs are illustrative.

export type Lang = 'id' | 'en';
export type ArtKind = 'stick' | 'pepper' | 'whitepepper' | 'clove' | 'nut' | 'mace' | 'turmeric' | 'ginger' | 'cardamom';
export type Category = 'bark' | 'seed' | 'flower' | 'root';

export type Product = {
  id: string;
  art: ArtKind;
  category: Category;
  origin: string;
  color: string;
  name: Record<Lang, string>;
  latin: string;
  desc: Record<Lang, string>;
  specs: { label: Record<Lang, string>; value: Record<Lang, string> }[];
  packs: string[];
  moq: string;
};

const s = (idLabel: string, enLabel: string, idValue: string, enValue = idValue) => ({ label: { id: idLabel, en: enLabel }, value: { id: idValue, en: enValue } });

export const PRODUCTS: Product[] = [
  {
    id: 'kayu-manis',
    art: 'stick',
    category: 'bark',
    origin: 'Kerinci, Jambi',
    color: '#8a4b2a',
    name: { id: 'Kayu Manis', en: 'Cinnamon (Cassia)' },
    latin: 'Cinnamomum burmannii',
    desc: {
      id: 'Kulit kayu manis Kerinci dengan aroma hangat dan rasa manis yang kuat. Tersedia dalam bentuk stik, potongan, dan bubuk.',
      en: 'Kerinci cassia bark with a warm aroma and strong, sweet flavour. Available as sticks, cut, or powder.',
    },
    specs: [s('Grade', 'Grade', 'AA · A · B'), s('Kadar air', 'Moisture', 'Maks. 13%', 'Max. 13%'), s('Panjang stik', 'Stick length', '8 cm · 10 cm · 12 cm'), s('Kadar minyak', 'Oil content', '2–4%')],
    packs: ['1 kg', '5 kg', '25 kg'],
    moq: '100 kg',
  },
  {
    id: 'lada-hitam',
    art: 'pepper',
    category: 'seed',
    origin: 'Lampung',
    color: '#2b2622',
    name: { id: 'Lada Hitam', en: 'Black Pepper' },
    latin: 'Piper nigrum',
    desc: {
      id: 'Lada hitam Lampung yang pedas dan aromatik, dijemur alami dan disortir ukurannya.',
      en: 'Pungent, aromatic Lampung black pepper, sun-dried and size-graded.',
    },
    specs: [s('Densitas', 'Density', '500–570 g/l'), s('Kadar air', 'Moisture', 'Maks. 12%', 'Max. 12%'), s('Benda asing', 'Extraneous matter', 'Maks. 1%', 'Max. 1%')],
    packs: ['1 kg', '25 kg', '50 kg'],
    moq: '100 kg',
  },
  {
    id: 'lada-putih',
    art: 'whitepepper',
    category: 'seed',
    origin: 'Bangka (Muntok)',
    color: '#d8ccb4',
    name: { id: 'Lada Putih', en: 'White Pepper' },
    latin: 'Piper nigrum',
    desc: {
      id: 'Lada putih Muntok yang terkenal: bersih, pedas halus, dan sangat dicari pasar ekspor.',
      en: 'The renowned Muntok white pepper: clean, refined heat, sought after by export buyers.',
    },
    specs: [s('Densitas', 'Density', '600–630 g/l'), s('Kadar air', 'Moisture', 'Maks. 13%', 'Max. 13%'), s('Biji hitam', 'Black berries', 'Maks. 1%', 'Max. 1%')],
    packs: ['1 kg', '25 kg', '50 kg'],
    moq: '100 kg',
  },
  {
    id: 'cengkeh',
    art: 'clove',
    category: 'flower',
    origin: 'Maluku',
    color: '#5a2f1c',
    name: { id: 'Cengkeh', en: 'Cloves' },
    latin: 'Syzygium aromaticum',
    desc: {
      id: 'Cengkeh Maluku dipetik tangan, utuh dengan kepala bunga, aroma tajam khas Nusantara.',
      en: 'Hand-picked Moluccan cloves, whole with heads, with the sharp aroma the islands are known for.',
    },
    specs: [s('Kadar air', 'Moisture', 'Maks. 14%', 'Max. 14%'), s('Kepala utuh', 'Headed', 'Min. 95%'), s('Kadar minyak', 'Oil content', '15–20%')],
    packs: ['1 kg', '10 kg', '25 kg'],
    moq: '50 kg',
  },
  {
    id: 'pala',
    art: 'nut',
    category: 'seed',
    origin: 'Banda, Maluku',
    color: '#9a6a3f',
    name: { id: 'Pala', en: 'Nutmeg' },
    latin: 'Myristica fragrans',
    desc: {
      id: 'Biji pala Banda, sumber rempah yang pernah diperebutkan dunia. Utuh, kering, dan wangi.',
      en: 'Banda nutmeg, the spice the world once fought over. Whole, dried and fragrant.',
    },
    specs: [s('Ukuran', 'Size', 'ABCD · 80–110 biji/lb', 'ABCD · 80–110 nuts/lb'), s('Kadar air', 'Moisture', 'Maks. 10%', 'Max. 10%'), s('Kondisi', 'Condition', 'Sound / shrivel')],
    packs: ['1 kg', '25 kg'],
    moq: '50 kg',
  },
  {
    id: 'fuli',
    art: 'mace',
    category: 'flower',
    origin: 'Banda, Maluku',
    color: '#c2410c',
    name: { id: 'Fuli (Bunga Pala)', en: 'Mace' },
    latin: 'Myristica fragrans',
    desc: {
      id: 'Selaput merah pembungkus biji pala, aromanya lebih halus. Favorit industri bumbu dan kue.',
      en: 'The red lacy aril around the nutmeg seed, with a softer aroma. A favourite of seasoning and bakery makers.',
    },
    specs: [s('Warna', 'Colour', 'Oranye-merah', 'Orange-red'), s('Kadar air', 'Moisture', 'Maks. 10%', 'Max. 10%'), s('Bentuk', 'Form', 'Utuh / patah', 'Whole / broken')],
    packs: ['1 kg', '10 kg'],
    moq: '25 kg',
  },
  {
    id: 'kunyit',
    art: 'turmeric',
    category: 'root',
    origin: 'Jawa Tengah',
    color: '#d97706',
    name: { id: 'Kunyit', en: 'Turmeric' },
    latin: 'Curcuma longa',
    desc: {
      id: 'Kunyit kering dengan kadar kurkumin tinggi dan warna kuning yang pekat. Irisan atau bubuk.',
      en: 'Dried turmeric with high curcumin content and a deep yellow colour. Sliced or powdered.',
    },
    specs: [s('Kurkumin', 'Curcumin', '3–5%'), s('Kadar air', 'Moisture', 'Maks. 10%', 'Max. 10%'), s('Bentuk', 'Form', 'Irisan · bubuk', 'Slices · powder')],
    packs: ['1 kg', '25 kg'],
    moq: '100 kg',
  },
  {
    id: 'jahe',
    art: 'ginger',
    category: 'root',
    origin: 'Jawa Barat',
    color: '#c9a26b',
    name: { id: 'Jahe', en: 'Ginger' },
    latin: 'Zingiber officinale',
    desc: {
      id: 'Jahe emprit dan jahe gajah kering, pedas hangat untuk industri minuman dan herbal.',
      en: 'Dried small and large ginger, warm and spicy, for beverage and herbal manufacturers.',
    },
    specs: [s('Jenis', 'Variety', 'Emprit · gajah', 'Small · large'), s('Kadar air', 'Moisture', 'Maks. 12%', 'Max. 12%'), s('Bentuk', 'Form', 'Belah · irisan · bubuk', 'Split · slices · powder')],
    packs: ['1 kg', '25 kg'],
    moq: '100 kg',
  },
];

export const CATEGORIES: { id: 'all' | Category; label: Record<Lang, string> }[] = [
  { id: 'all', label: { id: 'Semua', en: 'All' } },
  { id: 'bark', label: { id: 'Kulit & batang', en: 'Bark' } },
  { id: 'seed', label: { id: 'Biji', en: 'Seeds' } },
  { id: 'flower', label: { id: 'Bunga', en: 'Flowers' } },
  { id: 'root', label: { id: 'Rimpang', en: 'Roots' } },
];

export const T = {
  id: {
    nav: { products: 'Produk', origin: 'Asal', process: 'Proses', quality: 'Kualitas', contact: 'Kontak' },
    cta: 'Minta penawaran',
    heroKicker: 'Pemasok rempah Nusantara',
    heroTitle: ['Rempah Nusantara,', 'dari kebun', 'ke dapur dunia.'],
    heroText: 'Kami mengumpulkan rempah terbaik langsung dari petani mitra, lalu menyortir, mengeringkan, dan mengemasnya untuk pembeli di dalam dan luar negeri.',
    heroSecondary: 'Lihat katalog',
    drag: 'Geser untuk memutar',
    stats: [
      ['8', 'komoditas utama'],
      ['6', 'daerah asal'],
      ['40 ton', 'kapasitas per bulan'],
      ['COA', 'di setiap pengiriman'],
    ],
    productsTitle: 'Katalog rempah',
    productsText: 'Spesifikasi lengkap untuk setiap produk. Pilih rempah untuk melihat detail dan meminta penawaran.',
    detail: 'Lihat detail',
    origin: 'Asal',
    packs: 'Kemasan',
    moq: 'Minimal order',
    addToQuote: 'Tambahkan ke permintaan',
    originTitle: 'Asal yang bisa ditelusuri',
    originText: 'Setiap rempah punya rumah. Kami bekerja langsung dengan petani di daerah asalnya, jadi mutu dan ceritanya jelas.',
    processTitle: 'Dari kebun ke dapur dunia',
    processText: 'Lima tahap yang kami jaga di setiap batch.',
    steps: [
      ['Panen', 'Dipetik saat matang oleh petani mitra.'],
      ['Sortir', 'Dipilah ukuran dan mutunya dengan tangan.'],
      ['Jemur', 'Dikeringkan sampai kadar air sesuai standar.'],
      ['Kemas', 'Dikemas rapat, berlabel batch dan tanggal.'],
      ['Kirim', 'Dikirim ke seluruh Indonesia dan luar negeri.'],
    ],
    qualityTitle: 'Mutu yang bisa dibuktikan',
    quality: [
      ['Uji kadar air', 'Setiap batch diukur sebelum dikemas.'],
      ['Sertifikat analisis (COA)', 'Dikirim bersama setiap pesanan.'],
      ['Siap ekspor', 'Fumigasi dan dokumen ekspor dapat disiapkan.'],
      ['Ketertelusuran batch', 'Kode batch mengarah ke daerah dan tanggal panen.'],
    ],
    inquiryTitle: 'Minta penawaran',
    inquiryText: 'Ceritakan kebutuhan Anda. Tim kami membalas dengan harga dan ketersediaan.',
    form: { name: 'Nama', company: 'Perusahaan', country: 'Negara / kota', products: 'Produk yang diminati', qty: 'Perkiraan jumlah (kg)', note: 'Catatan', send: 'Kirim permintaan' },
    sent: 'Permintaan terkirim (demo). Di website asli, pesan ini langsung masuk ke WhatsApp atau email Anda.',
    footer: 'Pemasok rempah Nusantara untuk industri makanan, minuman, dan herbal.',
    demoBar: 'Demo website oleh Vertinova · nama, angka & data hanya ilustrasi',
    demoProposal: 'Lihat usulan',
    demoContact: 'Buat yang seperti ini',
  },
  en: {
    nav: { products: 'Products', origin: 'Origins', process: 'Process', quality: 'Quality', contact: 'Contact' },
    cta: 'Request a quote',
    heroKicker: 'Indonesian spice supplier',
    heroTitle: ['Indonesian spices,', 'from our farms', 'to kitchens worldwide.'],
    heroText: 'We source the finest spices directly from partner farmers, then sort, dry and pack them for buyers at home and abroad.',
    heroSecondary: 'Browse the catalogue',
    drag: 'Drag to rotate',
    stats: [
      ['8', 'core commodities'],
      ['6', 'regions of origin'],
      ['40 t', 'monthly capacity'],
      ['COA', 'with every shipment'],
    ],
    productsTitle: 'Spice catalogue',
    productsText: 'Full specifications for every product. Pick a spice to see details and request a quote.',
    detail: 'View details',
    origin: 'Origin',
    packs: 'Packaging',
    moq: 'Minimum order',
    addToQuote: 'Add to quote request',
    originTitle: 'Origins you can trace',
    originText: 'Every spice has a home. We work directly with farmers where each one grows, so quality and story stay clear.',
    processTitle: 'From farm to kitchens worldwide',
    processText: 'Five steps we guard in every batch.',
    steps: [
      ['Harvest', 'Picked at peak ripeness by partner farmers.'],
      ['Sort', 'Hand-sorted by size and grade.'],
      ['Dry', 'Dried to the target moisture level.'],
      ['Pack', 'Sealed and labelled with batch and date.'],
      ['Ship', 'Delivered across Indonesia and overseas.'],
    ],
    qualityTitle: 'Quality you can verify',
    quality: [
      ['Moisture testing', 'Every batch is measured before packing.'],
      ['Certificate of analysis', 'Sent with every order.'],
      ['Export ready', 'Fumigation and export documents on request.'],
      ['Batch traceability', 'Each batch code points to region and harvest date.'],
    ],
    inquiryTitle: 'Request a quote',
    inquiryText: 'Tell us what you need. Our team replies with pricing and availability.',
    form: { name: 'Name', company: 'Company', country: 'Country / city', products: 'Products of interest', qty: 'Estimated quantity (kg)', note: 'Notes', send: 'Send request' },
    sent: 'Request sent (demo). On the real site, this message goes straight to your WhatsApp or email.',
    footer: 'Indonesian spice supplier for food, beverage and herbal manufacturers.',
    demoBar: 'Website demo by Vertinova · names, figures & data are illustrative',
    demoProposal: 'See proposal',
    demoContact: 'Build one like this',
  },
} as const;

export type Copy = (typeof T)[Lang];
