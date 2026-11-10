import { ArrowRight, ArrowUpRight, Check, Mail, MessageCircle, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { COMPANY, mailtoLink, projectById, whatsappLink } from '../landing/projects';

/*
 * vertinova.id/rempah: proposal page for a prospective client who sells spices.
 * Their question: "company profile, or a custom system? So far we want products + company profile."
 * The page answers that plainly, then shows what their site would contain and look like.
 */

const container = 'mx-auto w-full max-w-[1160px] px-4';
const SUBJECT = 'Website company profile & katalog rempah';
const btn = {
  base: 'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border-[1.5px] px-[22px] text-[15px] font-bold no-underline transition hover:-translate-y-px max-sm:flex-1 max-sm:basis-full',
  solid: 'border-stone-900 bg-stone-900 text-[#faf6ee] hover:border-orange-800 hover:bg-orange-800',
  line: 'border-stone-900 text-stone-900',
  light: 'border-[#faf6ee] bg-[#faf6ee] text-stone-900',
  outlineLight: 'border-[#faf6ee]/40 text-[#faf6ee] hover:border-[#faf6ee]',
};

// Spice swatches drawn in CSS: no stock photos, no copyrighted images.
const SPICES = [
  { name: 'Kayu manis', color: '#8a4b2a', grain: '#a8653d' },
  { name: 'Kunyit', color: '#d4930f', grain: '#e8ad2e' },
  { name: 'Lada hitam', color: '#2b2622', grain: '#4a423b' },
  { name: 'Cengkeh', color: '#5a2f1c', grain: '#7a4430' },
  { name: 'Pala', color: '#a26a3c', grain: '#bf8655' },
  { name: 'Jahe', color: '#c9a26b', grain: '#dcbb88' },
];

const PAGES = [
  { name: 'Beranda', text: 'Kesan pertama: siapa Anda, rempah apa yang Anda jual, dan tombol untuk langsung menghubungi.' },
  { name: 'Tentang Kami', text: 'Cerita usaha, asal bahan, kapasitas, legalitas, dan orang-orang di baliknya.' },
  { name: 'Katalog Produk', text: 'Setiap rempah punya halaman sendiri: foto, asal daerah, grade, kemasan, dan minimal order.' },
  { name: 'Kualitas & Proses', text: 'Sortir, pengeringan, pengemasan, dan sertifikat yang Anda miliki. Inilah yang membuat pembeli yakin.' },
  { name: 'Galeri', text: 'Foto gudang, kebun mitra, dan proses kerja. Pembeli suka melihat yang nyata.' },
  { name: 'Kontak & Penawaran', text: 'Form permintaan harga, WhatsApp, email, dan lokasi di peta.' },
];

const TRUST = [
  'Asal daerah setiap rempah jelas',
  'Spesifikasi lengkap: grade, kadar air, ukuran',
  'Pilihan kemasan & minimal order tertulis',
  'Legalitas usaha & sertifikat ditampilkan',
  'Foto asli produk dan gudang',
  'Cara menghubungi yang cepat (WhatsApp, email)',
];

const PACKAGES = [
  {
    name: 'Profil Perusahaan',
    for: 'Mulai hadir online dengan rapi.',
    items: ['Beranda, Tentang Kami, Kontak', 'Ringkasan produk dalam satu halaman', 'Tombol WhatsApp', 'Tampil baik di HP'],
  },
  {
    name: 'Profil + Katalog',
    for: 'Yang paling sesuai dengan kebutuhan Anda saat ini.',
    recommended: true,
    items: ['Semua di paket Profil Perusahaan', 'Halaman detail untuk setiap produk', 'Form permintaan penawaran', 'Halaman Kualitas & Galeri', 'Produk bisa ditambah dan diubah'],
  },
  {
    name: 'Katalog untuk Ekspor',
    for: 'Kalau Anda menyasar pembeli luar negeri.',
    items: ['Semua di paket Profil + Katalog', 'Dua bahasa: Indonesia & Inggris', 'Spesifikasi gaya B2B (HS code, kapasitas)', 'Form inquiry untuk importir'],
  },
];

const STEPS = [
  { title: 'Ngobrol', text: 'Kita bahas produk, target pembeli, dan contoh website yang Anda suka.' },
  { title: 'Rancang', text: 'Kami susun struktur halaman dan tampilan awal untuk Anda setujui.' },
  { title: 'Bangun & isi', text: 'Website dibangun dan diisi dengan produk, foto, dan cerita usaha Anda.' },
  { title: 'Tayang & dampingi', text: 'Website online di domain Anda, lalu kami ajari cara memperbarui produk.' },
];

const CHECKLIST = ['Logo usaha', 'Daftar produk & spesifikasinya', 'Foto produk (foto HP yang terang pun cukup untuk mulai)', 'Cerita singkat usaha', 'Legalitas / sertifikat (jika ada)', 'Nomor WhatsApp & alamat'];

const FAQ = [
  {
    q: 'Jadi kami butuh company profile atau sistem khusus?',
    a: 'Company profile dengan katalog produk. Sistem khusus baru dibutuhkan kalau Anda ingin, misalnya, stok gudang tersambung otomatis, pembayaran online, atau akun khusus reseller. Itu bisa ditambahkan bertahap nanti.',
  },
  {
    q: 'Apakah kami bisa menambah atau mengubah produk sendiri?',
    a: 'Bisa. Kami siapkan cara memperbarui produk yang sederhana, dan kami ajari sampai tim Anda nyaman. Kalau lebih praktis, kami juga bisa bantu mengubahkannya.',
  },
  {
    q: 'Perlu dua bahasa?',
    a: 'Kalau pembeli Anda ada yang dari luar negeri, sebaiknya iya. Kalau saat ini fokus ke pembeli dalam negeri, bahasa Indonesia saja sudah cukup, dan bahasa Inggris bisa ditambahkan nanti.',
  },
  {
    q: 'Bisakah pembeli langsung memesan di website?',
    a: 'Untuk penjualan rempah dalam jumlah besar, biasanya pembeli minta penawaran dulu. Jadi kami sarankan tombol "Minta Penawaran" yang langsung masuk ke WhatsApp atau email Anda. Toko online lengkap bisa jadi tahap berikutnya.',
  },
  {
    q: 'Berapa biayanya?',
    a: 'Tergantung jumlah produk, jumlah bahasa, dan paket yang dipilih. Ceritakan sedikit soal usaha Anda, lalu kami kirim penawaran tertulis yang jelas rinciannya, tanpa biaya tersembunyi.',
  },
];

export default function RempahPage() {
  useEffect(() => {
    document.title = 'Website untuk Bisnis Rempah · Vertinova';
    // A proposal for one prospective client: keep it out of search results.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const wa = whatsappLink('Halo Vertinova, saya ingin ngobrol soal website company profile & katalog rempah.');
  const mail = mailtoLink(SUBJECT, 'Halo Vertinova,\n\nSaya tertarik membuat website untuk usaha rempah kami.\n\nNama usaha:\nProduk utama:\nTarget pembeli (lokal / ekspor):\n');
  const sire = projectById('sire');

  return (
    <main className="min-h-screen overflow-x-clip bg-[#faf6ee] font-jakarta text-stone-900 antialiased [text-rendering:auto] [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-amber-500">
      <header className="border-b border-stone-300/70">
        <div className={`${container} flex items-center justify-between gap-3 py-3.5`}>
          <a href="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-stone-900 no-underline">
            <img src={COMPANY.logo} alt="" className="size-8 object-contain" />
            Vertinova
          </a>
          <a href={wa || mail} target={wa ? '_blank' : undefined} rel="noopener noreferrer" className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-[#faf6ee] no-underline hover:bg-orange-800">
            Hubungi kami
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className={`${container} grid items-center gap-12 pt-12 sm:pt-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pt-20`}>
        <div>
          <p className="m-0 text-sm font-semibold text-orange-800">Usulan website untuk usaha rempah Anda</p>
          <h1 className="mt-4 mb-0 font-display text-[clamp(38px,5.2vw,68px)] leading-[1.02] font-extrabold tracking-[-0.04em]">
            Biarkan pembeli mengenal rempah Anda <span className="text-orange-800">sebelum mereka menelepon.</span>
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-stone-600">
            Jawaban singkat untuk pertanyaan Anda: yang dibutuhkan adalah <b className="text-stone-900">company profile dengan katalog produk</b>, bukan sistem khusus. Kabar baiknya,
            ini lebih cepat jadi, lebih mudah dirawat, dan langsung bisa dipakai untuk meyakinkan pembeli.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <a className={`${btn.base} ${btn.solid}`} href={wa || mail} target={wa ? '_blank' : undefined} rel="noopener noreferrer">
              Ngobrol soal website Anda <ArrowRight size={18} />
            </a>
            <a className={`${btn.base} ${btn.line}`} href="#isi">
              Lihat usulan isi
            </a>
          </div>
        </div>
        <SiteMockup />
      </section>

      {/* Company profile or custom? */}
      <Section id="jawaban" index="01" title="Company profile atau kebutuhan khusus?">
        <div className="grid gap-4 md:grid-cols-2">
          <ChoiceCard
            highlight
            title="Company profile + katalog"
            verdict="Ini yang Anda butuhkan sekarang"
            points={['Anda ingin dikenal & dipercaya pembeli', 'Produk ditampilkan rapi dengan spesifikasinya', 'Pembeli menghubungi lewat WhatsApp / form penawaran', 'Isi produk berubah sesekali, bukan tiap jam']}
          />
          <ChoiceCard
            title="Sistem khusus"
            verdict="Nanti, kalau memang diperlukan"
            points={['Stok gudang tersambung otomatis', 'Pemesanan & pembayaran online penuh', 'Akun khusus untuk reseller atau agen', 'Laporan penjualan & pengiriman']}
          />
        </div>
        <p className="mt-6 max-w-[720px] text-[16px] leading-relaxed text-stone-600">
          Website yang kami bangun bisa dikembangkan bertahap. Mulai dari profil dan katalog dulu, lalu tambahkan fitur saat usaha Anda membutuhkannya.
        </p>
      </Section>

      {/* Proposed content */}
      <Section id="isi" index="02" title="Usulan isi website Anda" sub="Disusun dari kebutuhan yang Anda sebutkan: produk dan profil perusahaan.">
        <ol className="m-0 grid list-none gap-px overflow-hidden rounded-2xl border border-stone-300 bg-stone-300 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {PAGES.map((p, i) => (
            <li key={p.name} className="bg-[#fffdf8] p-6">
              <span className="font-display text-sm font-bold text-orange-800">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 mb-2 font-display text-xl font-bold tracking-tight">{p.name}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-stone-600">{p.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Product page preview */}
      <Section id="produk" index="03" title="Seperti ini halaman produk Anda nanti" sub="Contoh tampilan. Isi dan desain akhirnya disesuaikan dengan produk dan merek Anda.">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <ProductMockup />
          <div>
            <h3 className="m-0 font-display text-2xl font-bold tracking-tight">Yang membuat pembeli yakin</h3>
            <p className="mt-2 mb-5 text-[15px] leading-relaxed text-stone-600">Pembeli rempah, terutama pembeli dalam jumlah besar, ingin tahu detail sebelum bertanya harga. Semakin jelas halaman produk Anda, semakin serius pertanyaan yang masuk.</p>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {TRUST.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-snug">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-orange-800 text-white">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Packages */}
      <Section id="paket" index="04" title="Pilihan paket" sub="Harga kami sampaikan dalam penawaran tertulis setelah tahu jumlah produk dan bahasa yang Anda perlukan.">
        <div className="grid gap-4 lg:grid-cols-3">
          {PACKAGES.map((p) => (
            <article
              key={p.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${p.recommended ? 'border-stone-900 bg-stone-900 text-[#faf6ee] lg:-my-3 lg:py-9' : 'border-stone-300 bg-[#fffdf8]'}`}
            >
              {p.recommended && <p className="m-0 mb-3 text-[13px] font-semibold text-amber-400">Rekomendasi untuk Anda</p>}
              <h3 className="m-0 font-display text-2xl font-bold tracking-tight">{p.name}</h3>
              <p className={`mt-1.5 mb-5 text-[15px] ${p.recommended ? 'text-stone-300' : 'text-stone-600'}`}>{p.for}</p>
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[15px] leading-snug">
                    <Check size={17} className={`mt-0.5 shrink-0 ${p.recommended ? 'text-amber-400' : 'text-orange-800'}`} />
                    {it}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      {/* Process + checklist */}
      <Section id="proses" index="05" title="Langkahnya sederhana">
        <ol className="m-0 grid list-none border-t border-stone-900 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-b border-stone-300 py-6 sm:pr-6 lg:border-b-0 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0">
              <span className="font-display text-sm font-bold text-orange-800">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2 mb-2 font-display text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-stone-600">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 rounded-2xl border border-dashed border-orange-800/40 bg-[#fffdf8] p-6 sm:p-8">
          <h3 className="m-0 font-display text-xl font-bold tracking-tight">Yang perlu Anda siapkan</h3>
          <p className="mt-1.5 mb-5 text-[15px] text-stone-600">Tidak perlu sempurna. Kami bantu merapikan tulisannya dan memilih foto terbaik.</p>
          <ul className="m-0 grid list-none gap-x-8 gap-y-3 p-0 sm:grid-cols-2">
            {CHECKLIST.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[15px] leading-snug">
                <span className="mt-0.5 size-4 shrink-0 rounded border-2 border-orange-800/60" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Proof */}
      {sire && (
        <Section id="karya" index="06" title="Sudah kami kerjakan untuk usaha lain">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <a href={sire.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_18px_36px_-24px_rgba(41,26,14,0.45)] transition-transform hover:-translate-y-1">
              <BrowserBar host={sire.url ? new URL(sire.url).host : ''} />
              <img src={sire.images[0].src} alt={sire.images[0].alt} loading="lazy" decoding="async" width={1600} height={1000} className="block aspect-[16/10] h-auto w-full object-cover object-top" />
            </a>
            <div>
              <p className="m-0 text-sm font-semibold text-orange-800">{sire.category}</p>
              <h3 className="mt-2 mb-3 font-display text-3xl font-extrabold tracking-tight">{sire.name}</h3>
              <p className="m-0 text-[16px] leading-relaxed text-stone-700">
                Website untuk usaha kopi: menu dengan harga, cerita kedai, dan pemesanan lewat WhatsApp. Pendekatannya sama dengan yang kami usulkan untuk Anda, yaitu
                produk tampil jelas dan pembeli mudah menghubungi.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                {sire.url && (
                  <a href={sire.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border-b-2 border-orange-800 pb-0.5 font-bold text-stone-900 no-underline hover:text-orange-800">
                    Buka {new URL(sire.url).host} <ArrowUpRight size={16} />
                  </a>
                )}
                <a href="/?mode=lite#karya" className="inline-flex items-center gap-1.5 border-b-2 border-stone-400 pb-0.5 font-bold text-stone-900 no-underline hover:border-stone-900">
                  Lihat karya lainnya <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* FAQ */}
      <Section id="tanya" index="07" title="Pertanyaan yang sering muncul">
        <div className="grid gap-3">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="group rounded-2xl border border-stone-300 bg-[#fffdf8] px-5 py-4 open:pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold tracking-tight [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-stone-300 transition-transform group-open:rotate-45" aria-hidden="true">
                  <X size={14} className="rotate-45" />
                </span>
              </summary>
              <p className="mt-3 mb-0 max-w-[820px] text-[15.5px] leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <div className={`${container} pt-20 lg:pt-28`}>
        <section className="relative overflow-hidden rounded-[28px] bg-stone-900 p-8 text-[#faf6ee] sm:p-12 lg:p-16">
          <SpiceDots className="pointer-events-none absolute -top-6 -right-6 hidden w-72 opacity-40 md:block" />
          <h2 className="relative m-0 max-w-[720px] font-display text-[clamp(30px,4.4vw,52px)] leading-[1.04] font-extrabold tracking-[-0.035em]">Rempah Anda sudah bagus. Saatnya pembeli bisa melihatnya.</h2>
          <p className="relative mt-4 mb-8 max-w-[600px] text-[17px] leading-relaxed text-stone-300">
            Ceritakan produk dan target pembeli Anda. Kami balas dengan usulan yang jelas dan penawaran tertulis, tanpa kewajiban apa pun.
          </p>
          <div className="relative flex flex-wrap gap-2.5">
            {wa && (
              <a className={`${btn.base} ${btn.light}`} href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} /> Chat WhatsApp
              </a>
            )}
            <a className={`${btn.base} ${wa ? btn.outlineLight : btn.light}`} href={mail}>
              <Mail size={18} /> {COMPANY.email}
            </a>
          </div>
        </section>
      </div>

      <footer className={`${container} flex flex-wrap justify-between gap-2 py-10 text-sm text-stone-500`}>
        <span>© {new Date().getFullYear()} Vertinova · Partner teknologi</span>
        <a href="/" className="font-semibold text-stone-900">
          vertinova.id
        </a>
      </footer>
    </main>
  );
}

function Section({ id, index, title, sub, children }: { id: string; index: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className={`${container} scroll-mt-6 pt-20 lg:pt-28`}>
      <div className="mb-9 grid gap-2.5 lg:mb-12">
        <span className="text-[13px] font-semibold tracking-[0.08em] text-orange-800">{index}</span>
        <h2 className="m-0 font-display text-[clamp(30px,4.2vw,50px)] leading-[1.04] font-extrabold tracking-[-0.035em]">{title}</h2>
        {sub && <p className="m-0 max-w-[720px] text-[17px] text-stone-600">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({ title, verdict, points, highlight = false }: { title: string; verdict: string; points: string[]; highlight?: boolean }) {
  return (
    <article className={`rounded-2xl border p-6 sm:p-7 ${highlight ? 'border-orange-800 bg-[#fffdf8] shadow-[0_0_0_3px_rgba(154,52,18,0.12)]' : 'border-stone-300 bg-transparent'}`}>
      <p className={`m-0 text-[13px] font-bold ${highlight ? 'text-orange-800' : 'text-stone-500'}`}>{verdict}</p>
      <h3 className="mt-1.5 mb-4 font-display text-2xl font-bold tracking-tight">{title}</h3>
      <ul className="m-0 grid list-none gap-2.5 p-0">
        {points.map((p) => (
          <li key={p} className={`flex items-start gap-2.5 text-[15px] leading-snug ${highlight ? '' : 'text-stone-600'}`}>
            <Check size={17} className={`mt-0.5 shrink-0 ${highlight ? 'text-orange-800' : 'text-stone-400'}`} />
            {p}
          </li>
        ))}
      </ul>
    </article>
  );
}

function BrowserBar({ host }: { host: string }) {
  return (
    <span className="flex items-center gap-1.5 border-b border-stone-300 bg-[#f1ebdf] px-3.5 py-2.5" aria-hidden="true">
      <i className="size-2.5 rounded-full bg-stone-300" />
      <i className="size-2.5 rounded-full bg-stone-300" />
      <i className="size-2.5 rounded-full bg-stone-300" />
      <b className="ml-2.5 flex-1 truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-500">{host}</b>
    </span>
  );
}

/** A heap of spice drawn with circles: decorative only. */
function SpiceDots({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      {SPICES.flatMap((s, i) =>
        Array.from({ length: 7 }, (_, k) => {
          const a = (i * 7 + k) * 2.39996;
          const r = 12 + ((i * 7 + k) % 9) * 9;
          return <circle key={`${i}-${k}`} cx={100 + Math.cos(a) * r} cy={100 + Math.sin(a) * r} r={6 + ((k * 3) % 5)} fill={k % 2 ? s.color : s.grain} />;
        }),
      )}
    </svg>
  );
}

/** Mock homepage of the client's future site, drawn with plain HTML so it stays crisp and light. */
function SiteMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[600px]">
      <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_30px_60px_-32px_rgba(41,26,14,0.55)] lg:rotate-[1.2deg]">
        <BrowserBar host="namausahaanda.com" />
        <div className="bg-[#2a1a10] px-6 pt-5 pb-7 text-[#f6ead7] sm:px-8">
          <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide opacity-80">
            <span className="font-display text-sm tracking-tight">Nama Usaha Anda</span>
            <span className="hidden gap-4 sm:flex">
              <span>Produk</span>
              <span>Tentang</span>
              <span>Kualitas</span>
              <span>Kontak</span>
            </span>
          </div>
          <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="m-0 font-display text-[clamp(20px,2.6vw,28px)] leading-[1.08] font-extrabold tracking-tight">Rempah pilihan dari kebun Nusantara.</p>
              <p className="mt-2 mb-4 text-[11px] leading-relaxed opacity-75">Disortir, dikeringkan, dan dikemas dengan standar yang konsisten.</p>
              <span className="inline-flex rounded-full bg-[#d4930f] px-3 py-1.5 text-[11px] font-bold text-[#2a1a10]">Minta Penawaran</span>
            </div>
            <SpiceDots className="mx-auto w-32 sm:w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-[#fffdf8] p-3 sm:gap-3 sm:p-4">
          {SPICES.slice(0, 3).map((s) => (
            <div key={s.name} className="rounded-lg border border-stone-200 bg-white p-2">
              <div className="aspect-[4/3] rounded-md" style={{ background: `radial-gradient(circle at 35% 35%, ${s.grain}, ${s.color})` }} />
              <p className="m-0 mt-1.5 truncate text-[11px] font-bold">{s.name}</p>
              <p className="m-0 text-[10px] text-stone-500">Lihat detail</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Example product detail page, clearly labelled as an example. */
function ProductMockup() {
  const spice = SPICES[0];
  const rows: [string, string][] = [
    ['Asal', 'Sumatera Barat'],
    ['Grade', 'A (contoh)'],
    ['Kadar air', 'Maks. 13%'],
    ['Kemasan', '1 kg · 5 kg · 25 kg'],
    ['Minimal order', '25 kg'],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_24px_48px_-30px_rgba(41,26,14,0.5)]">
      <BrowserBar host="namausahaanda.com/produk/kayu-manis" />
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.1fr] sm:p-6">
        <div>
          <div className="aspect-square rounded-xl" style={{ background: `radial-gradient(circle at 30% 30%, ${spice.grain}, ${spice.color} 70%)` }} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SPICES.slice(0, 3).map((s) => (
              <div key={s.name} className="aspect-square rounded-lg" style={{ background: `radial-gradient(circle at 35% 35%, ${s.grain}, ${s.color})` }} />
            ))}
          </div>
        </div>
        <div>
          <p className="m-0 text-[11px] font-bold tracking-wide text-orange-800 uppercase">Contoh halaman produk</p>
          <p className="mt-1 mb-1 font-display text-2xl font-extrabold tracking-tight">Kayu Manis</p>
          <p className="mt-0 mb-4 text-[13px] leading-relaxed text-stone-600">Kulit kayu manis kering dengan aroma kuat, cocok untuk industri makanan, minuman, dan bumbu.</p>
          <dl className="m-0 grid gap-0 text-[13px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-t border-stone-200 py-2">
                <dt className="text-stone-500">{k}</dt>
                <dd className="m-0 text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <span className="mt-4 flex items-center justify-center gap-2 rounded-full bg-stone-900 py-2.5 text-[13px] font-bold text-[#faf6ee]">
            <MessageCircle size={15} /> Minta penawaran via WhatsApp
          </span>
        </div>
      </div>
    </div>
  );
}
