import { ArrowRight, Check, FlaskConical, Globe2, Leaf, MapPin, Package, ScanLine, Ship, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { COMPANY, mailtoLink } from '../../landing/projects';
import { CATEGORIES, PRODUCTS, T, type Category, type Lang, type Product } from './data';
import { SpiceArt } from './SpiceArt';

// Demo website for a fictional spice company, shown to a prospective Vertinova client at vertinova.id/rempah.
const Hero3D = lazy(() => import('./Hero3D'));
const ProcessVideo = lazy(() => import('./ProcessVideo'));

const container = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6';
const COCOA = '#1f140d';

const ORIGINS: { region: string; island: string; ids: string[] }[] = [
  { region: 'Kerinci', island: 'Jambi, Sumatera', ids: ['kayu-manis'] },
  { region: 'Lampung', island: 'Sumatera', ids: ['lada-hitam'] },
  { region: 'Bangka', island: 'Kep. Bangka Belitung', ids: ['lada-putih'] },
  { region: 'Jawa Barat', island: 'Jawa', ids: ['jahe'] },
  { region: 'Jawa Tengah', island: 'Jawa', ids: ['kunyit'] },
  { region: 'Banda & Maluku', island: 'Maluku', ids: ['pala', 'fuli', 'cengkeh'] },
];

const QUALITY_ICONS = [FlaskConical, ScanLine, Ship, MapPin];

export default function RempahDemo() {
  const [lang, setLang] = useState<Lang>('id');
  const t = T[lang];
  const [category, setCategory] = useState<'all' | Category>('all');
  const [open, setOpen] = useState<Product | null>(null);
  const [quote, setQuote] = useState<string[]>([]);
  const inquiry = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = lang === 'id' ? 'Arunika Rempah · Demo oleh Vertinova' : 'Arunika Spices · Demo by Vertinova';
    document.documentElement.lang = lang;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [lang]);

  const products = useMemo(() => (category === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category)), [category]);

  const addToQuote = (id: string) => {
    setQuote((q) => (q.includes(id) ? q : [...q, id]));
    setOpen(null);
    requestAnimationFrame(() => inquiry.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f7efe2] pb-16 font-jakarta text-[#2a1a10] antialiased [text-rendering:auto] [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-amber-500">
      <Header t={t} lang={lang} setLang={setLang} />

      {/* Hero */}
      <section className="relative overflow-hidden text-[#f7efe2]" style={{ background: `radial-gradient(ellipse at 75% 35%, #5a3418 0%, ${COCOA} 62%)` }}>
        <div className={`${container} relative grid items-center gap-6 pt-10 pb-14 lg:min-h-[640px] lg:grid-cols-[1fr_1.05fr] lg:pt-6 lg:pb-10`}>
          <div className="order-2 lg:order-1">
            <p className="m-0 text-[13px] font-semibold tracking-[0.18em] text-[#e0a526] uppercase">{t.heroKicker}</p>
            <h1 className="mt-4 mb-0 font-display text-[clamp(42px,6vw,84px)] leading-[0.98] font-extrabold tracking-[-0.035em]">
              {t.heroTitle[0]} <span className="text-[#e0a526]">{t.heroTitle[1]}</span> {t.heroTitle[2]}
            </h1>
            <p className="mt-6 mb-0 max-w-[520px] text-[17px] leading-relaxed text-[#f7efe2]/75">{t.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#penawaran" className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#e0a526] px-6 text-[15px] font-bold text-[#1f140d] no-underline transition hover:bg-[#f0bd4a] max-sm:flex-1 max-sm:justify-center">
                {t.cta} <ArrowRight size={18} />
              </a>
              <a href="#produk" className="inline-flex min-h-[52px] items-center rounded-full border-[1.5px] border-[#f7efe2]/35 px-6 text-[15px] font-bold text-[#f7efe2] no-underline transition hover:border-[#f7efe2] max-sm:flex-1 max-sm:justify-center">
                {t.heroSecondary}
              </a>
            </div>
          </div>
          <div className="relative order-1 aspect-square w-full max-w-[680px] justify-self-center lg:order-2 lg:-mr-8">
            <Suspense fallback={<HeroFallback />}>
              <Hero3D />
            </Suspense>
            <p className="pointer-events-none absolute right-2 bottom-2 m-0 text-xs text-[#f7efe2]/50 max-lg:hidden">{t.drag}</p>
          </div>
        </div>
        <div className={`${container} relative pb-10`}>
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {t.stats.map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-[#f7efe2]/10 bg-[#f7efe2]/[0.04] p-5">
                <dt className="font-display text-[clamp(28px,3.2vw,40px)] leading-none font-extrabold tracking-[-0.03em] text-[#e0a526]">{value}</dt>
                <dd className="m-0 mt-2 text-sm text-[#f7efe2]/65">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Catalogue */}
      <section id="produk" className={`${container} scroll-mt-20 pt-20 lg:pt-28`}>
        <SectionHead title={t.productsTitle} text={t.productsText} />
        <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label={t.productsTitle}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition ${category === c.id ? 'border-[#2a1a10] bg-[#2a1a10] text-[#f7efe2]' : 'border-[#2a1a10]/20 bg-transparent text-[#2a1a10] hover:border-[#2a1a10]/60'}`}
            >
              {c.label[lang]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpen(p)}
              className="group flex flex-col overflow-hidden rounded-[22px] border border-[#2a1a10]/10 bg-[#fffaf1] p-0 text-left transition hover:-translate-y-1 hover:shadow-[0_24px_40px_-26px_rgba(42,26,16,0.55)]"
            >
              <span className="relative block aspect-[4/3.4] overflow-hidden" style={{ background: `radial-gradient(circle at 50% 60%, ${p.color}33, ${p.color}14 70%)` }}>
                <SpiceArt kind={p.art} className="absolute inset-[14%] h-[72%] w-[72%] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" />
              </span>
              <span className="flex flex-1 flex-col p-4 sm:p-5">
                <span className="font-display text-[clamp(18px,2vw,22px)] leading-tight font-bold">{p.name[lang]}</span>
                <span className="mt-0.5 text-[13px] text-[#2a1a10]/55 italic">{p.latin}</span>
                <span className="mt-3 flex items-center gap-1.5 text-[13px] text-[#2a1a10]/70">
                  <MapPin size={14} className="shrink-0 text-[#9c4a24]" /> {p.origin}
                </span>
                <span className="mt-auto pt-4 text-[13px] font-bold text-[#9c4a24]">{t.detail} →</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Origins */}
      <section id="asal" className={`${container} scroll-mt-20 pt-20 lg:pt-28`}>
        <SectionHead title={t.originTitle} text={t.originText} />
        <div className="relative">
          <div className="absolute top-[22px] right-0 left-0 hidden border-t-2 border-dashed border-[#9c4a24]/30 lg:block" aria-hidden="true" />
          <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
            {ORIGINS.map((o, i) => (
              <li key={o.region} className="relative">
                <span className="relative z-10 grid size-11 place-items-center rounded-full border-2 border-[#9c4a24] bg-[#f7efe2] font-display text-lg font-bold text-[#9c4a24]">{i + 1}</span>
                <h3 className="mt-3 mb-0 font-display text-xl font-bold">{o.region}</h3>
                <p className="mt-0.5 mb-3 text-[13px] text-[#2a1a10]/60">{o.island}</p>
                <div className="flex flex-wrap gap-1.5">
                  {o.ids.map((id) => {
                    const p = PRODUCTS.find((x) => x.id === id)!;
                    return (
                      <button key={id} onClick={() => setOpen(p)} className="inline-flex items-center gap-1.5 rounded-full border border-[#2a1a10]/15 bg-[#fffaf1] py-1 pr-3 pl-1 text-[13px] font-semibold hover:border-[#9c4a24]">
                        <SpiceArt kind={p.art} className="size-6" />
                        {p.name[lang]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Process (Remotion) */}
      <section id="proses" className={`${container} scroll-mt-20 pt-20 lg:pt-28`}>
        <SectionHead title={t.processTitle} text={t.processText} />
        <Suspense fallback={<div className="aspect-video w-full rounded-[22px] bg-[#1f140d]" />}>
          <ProcessVideo steps={t.steps} world={lang === 'id' ? 'Dunia' : 'World'} />
        </Suspense>
        <ol className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-5">
          {t.steps.map(([title, text], i) => (
            <li key={title} className="text-sm leading-snug text-[#2a1a10]/70">
              <b className="block font-display text-base text-[#2a1a10]">
                {String(i + 1).padStart(2, '0')} · {title}
              </b>
              {text}
            </li>
          ))}
        </ol>
      </section>

      {/* Quality */}
      <section id="kualitas" className={`${container} scroll-mt-20 pt-20 lg:pt-28`}>
        <SectionHead title={t.qualityTitle} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.quality.map(([title, text], i) => {
            const Icon = QUALITY_ICONS[i];
            return (
              <article key={title} className="rounded-[22px] border border-[#2a1a10]/10 bg-[#fffaf1] p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#4f6b3a]/12 text-[#4f6b3a]">
                  <Icon size={22} />
                </span>
                <h3 className="mt-4 mb-1.5 font-display text-xl font-bold">{title}</h3>
                <p className="m-0 text-[15px] leading-relaxed text-[#2a1a10]/70">{text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Inquiry */}
      <section id="penawaran" ref={inquiry} className={`${container} scroll-mt-20 pt-20 lg:pt-28`}>
        <div className="grid gap-8 overflow-hidden rounded-[28px] p-6 text-[#f7efe2] sm:p-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:p-14" style={{ background: `radial-gradient(ellipse at 20% 0%, #5a3418, ${COCOA} 70%)` }}>
          <div>
            <h2 className="m-0 font-display text-[clamp(32px,4.4vw,52px)] leading-[1.04] font-extrabold tracking-[-0.035em]">{t.inquiryTitle}</h2>
            <p className="mt-4 mb-6 max-w-[440px] text-[17px] leading-relaxed text-[#f7efe2]/70">{t.inquiryText}</p>
            <div className="hidden gap-3 lg:grid">
              {[
                [Leaf, 'arunika-rempah.co.id'],
                [Globe2, lang === 'id' ? 'Melayani domestik & ekspor' : 'Serving domestic & export buyers'],
                [Package, lang === 'id' ? 'Kemasan 1 kg sampai 50 kg' : 'Packs from 1 kg to 50 kg'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Leaf;
                return (
                  <p key={label as string} className="m-0 flex items-center gap-3 text-[15px] text-[#f7efe2]/80">
                    <I size={18} className="text-[#e0a526]" /> {label as string}
                  </p>
                );
              })}
            </div>
          </div>
          <InquiryForm t={t} lang={lang} quote={quote} setQuote={setQuote} />
        </div>
      </section>

      <footer className={`${container} mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[#2a1a10]/10 py-8 text-sm text-[#2a1a10]/60`}>
        <span className="flex items-center gap-2">
          <Logo className="size-6" /> Arunika Rempah · {t.footer}
        </span>
        <span>© {new Date().getFullYear()}</span>
      </footer>

      {open && <ProductModal product={open} t={t} lang={lang} onClose={() => setOpen(null)} onQuote={addToQuote} />}
      <DemoBar t={t} />
    </main>
  );
}

function Header({ t, lang, setLang }: { t: (typeof T)[Lang]; lang: Lang; setLang: (l: Lang) => void }) {
  const links: [string, string][] = [
    ['#produk', t.nav.products],
    ['#asal', t.nav.origin],
    ['#proses', t.nav.process],
    ['#kualitas', t.nav.quality],
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-[#f7efe2]/10 bg-[#1f140d] text-[#f7efe2]">
      <div className={`${container} flex h-16 items-center justify-between gap-3`}>
        <a href="#" className="flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-[#f7efe2] no-underline">
          <Logo className="size-8" />
          Arunika<span className="font-jakarta text-xs font-semibold tracking-[0.2em] text-[#e0a526] uppercase max-sm:hidden">Rempah</span>
        </a>
        <nav className="flex items-center gap-1" aria-label="Navigasi">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-[#f7efe2]/80 no-underline hover:text-[#f7efe2] max-lg:hidden">
              {label}
            </a>
          ))}
          <div className="ml-1 flex rounded-full border border-[#f7efe2]/20 p-0.5 text-xs font-bold" role="group" aria-label="Bahasa / Language">
            {(['id', 'en'] as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-2.5 py-1.5 uppercase ${lang === l ? 'bg-[#f7efe2] text-[#1f140d]' : 'text-[#f7efe2]/70'}`}>
                {l}
              </button>
            ))}
          </div>
          <a href="#penawaran" className="ml-1 rounded-full bg-[#e0a526] px-4 py-2 text-sm font-bold text-[#1f140d] no-underline hover:bg-[#f0bd4a] max-sm:hidden">
            {t.cta}
          </a>
        </nav>
      </div>
    </header>
  );
}

function SectionHead({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-8 max-w-[720px] lg:mb-12">
      <h2 className="m-0 font-display text-[clamp(32px,4.4vw,54px)] leading-[1.04] font-extrabold tracking-[-0.035em]">{title}</h2>
      {text && <p className="mt-3 mb-0 text-[17px] leading-relaxed text-[#2a1a10]/70">{text}</p>}
    </div>
  );
}

function ProductModal({ product: p, t, lang, onClose, onQuote }: { product: Product; t: (typeof T)[Lang]; lang: Lang; onClose: () => void; onQuote: (id: string) => void }) {
  const [pack, setPack] = useState(p.packs[0]);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    // Flex + margin:auto centres the card and never clips its top on short screens.
    <div className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain bg-[#1f140d]/70 p-3 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={p.name[lang]}
        onClick={(e) => e.stopPropagation()}
        className="relative m-auto grid w-full max-w-[920px] overflow-hidden rounded-[26px] bg-[#fffaf1] shadow-2xl outline-none md:grid-cols-[1fr_1.1fr]"
      >
        <button onClick={onClose} aria-label="Tutup" className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-[#fffaf1]/90 text-[#2a1a10] shadow">
          <X size={18} />
        </button>
        <div className="relative grid min-h-[220px] place-items-center p-8" style={{ background: `radial-gradient(circle at 50% 55%, ${p.color}40, ${p.color}18 70%)` }}>
          <SpiceArt kind={p.art} className="w-[72%] max-w-[300px]" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-[#fffaf1] px-3 py-1.5 text-[13px] font-semibold">
            <MapPin size={14} className="text-[#9c4a24]" /> {p.origin}
          </span>
        </div>
        <div className="p-6 sm:p-8">
          <p className="m-0 text-[13px] text-[#2a1a10]/55 italic">{p.latin}</p>
          <h2 className="mt-1 mb-3 font-display text-[clamp(28px,3.4vw,38px)] leading-tight font-bold">{p.name[lang]}</h2>
          <p className="mt-0 mb-5 text-[15px] leading-relaxed text-[#2a1a10]/75">{p.desc[lang]}</p>
          <dl className="m-0 grid text-[14px]">
            {p.specs.map((s) => (
              <div key={s.label.en} className="flex justify-between gap-4 border-t border-[#2a1a10]/10 py-2.5">
                <dt className="text-[#2a1a10]/60">{s.label[lang]}</dt>
                <dd className="m-0 text-right font-semibold">{s.value[lang]}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-y border-[#2a1a10]/10 py-2.5">
              <dt className="text-[#2a1a10]/60">{t.moq}</dt>
              <dd className="m-0 text-right font-semibold">{p.moq}</dd>
            </div>
          </dl>
          <p className="mt-5 mb-2 text-[13px] font-bold">{t.packs}</p>
          <div className="flex flex-wrap gap-2">
            {p.packs.map((k) => (
              <button
                key={k}
                onClick={() => setPack(k)}
                aria-pressed={pack === k}
                className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-sm font-semibold ${pack === k ? 'border-[#9c4a24] bg-[#9c4a24] text-white' : 'border-[#2a1a10]/20 text-[#2a1a10]'}`}
              >
                {k}
              </button>
            ))}
          </div>
          <button onClick={() => onQuote(p.id)} className="mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#1f140d] px-6 text-[15px] font-bold text-[#f7efe2] hover:bg-[#9c4a24]">
            {t.addToQuote} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function InquiryForm({ t, lang, quote, setQuote }: { t: (typeof T)[Lang]; lang: Lang; quote: string[]; setQuote: (fn: (q: string[]) => string[]) => void }) {
  const [sent, setSent] = useState(false);
  const field = 'w-full rounded-xl border border-[#f7efe2]/15 bg-[#f7efe2]/[0.06] px-3.5 py-3 text-[15px] text-[#f7efe2] outline-none placeholder:text-[#f7efe2]/35 focus:border-[#e0a526]';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true); // Demo only: nothing leaves the browser.
  };
  if (sent) {
    return (
      <div className="grid place-items-center rounded-2xl border border-[#e0a526]/40 bg-[#e0a526]/10 p-8 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-[#e0a526] text-[#1f140d]">
          <Check size={28} strokeWidth={3} />
        </span>
        <p className="mt-4 mb-5 max-w-[360px] text-[16px] leading-relaxed">{t.sent}</p>
        <button onClick={() => setSent(false)} className="rounded-full border-[1.5px] border-[#f7efe2]/40 px-5 py-2 text-sm font-bold text-[#f7efe2]">
          OK
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="grid gap-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px] font-semibold text-[#f7efe2]/80">
          {t.form.name}
          <input required className={field} autoComplete="name" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-[#f7efe2]/80">
          {t.form.company}
          <input className={field} autoComplete="organization" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-[#f7efe2]/80">
          {t.form.country}
          <input className={field} />
        </label>
        <label className="grid gap-1.5 text-[13px] font-semibold text-[#f7efe2]/80">
          {t.form.qty}
          <input type="number" min={1} inputMode="numeric" className={field} />
        </label>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[13px] font-semibold text-[#f7efe2]/80">{t.form.products}</legend>
        <div className="flex flex-wrap gap-2">
          {PRODUCTS.map((p) => {
            const on = quote.includes(p.id);
            return (
              <button
                type="button"
                key={p.id}
                aria-pressed={on}
                onClick={() => setQuote((q) => (on ? q.filter((x) => x !== p.id) : [...q, p.id]))}
                className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] py-1 pr-3 pl-1 text-[13px] font-semibold transition ${on ? 'border-[#e0a526] bg-[#e0a526] text-[#1f140d]' : 'border-[#f7efe2]/20 text-[#f7efe2]/85 hover:border-[#f7efe2]/50'}`}
              >
                <SpiceArt kind={p.art} className="size-6" />
                {p.name[lang]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-[13px] font-semibold text-[#f7efe2]/80">
        {t.form.note}
        <textarea rows={3} className={`${field} resize-y`} />
      </label>
      <button type="submit" className="mt-1 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#e0a526] px-6 text-[15px] font-bold text-[#1f140d] hover:bg-[#f0bd4a]">
        {t.form.send} <ArrowRight size={18} />
      </button>
    </form>
  );
}

/** Fixed strip that makes it unmistakable this is a Vertinova demo, with a way to get in touch. */
function DemoBar({ t }: { t: (typeof T)[Lang] }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f7efe2]/10 bg-[#120b07]/95 text-[#f7efe2] backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className={`${container} flex min-h-12 items-center justify-between gap-3 py-2 text-[13px]`}>
        <span className="flex min-w-0 items-center gap-2">
          <img src={COMPANY.logo} alt="" className="size-5 shrink-0 rounded-full bg-white object-contain" />
          <span className="truncate text-[#f7efe2]/75">{t.demoBar}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <a href="/rempah/usulan" className="rounded-full px-3 py-1.5 font-semibold text-[#f7efe2]/80 no-underline hover:text-[#f7efe2] max-sm:hidden">
            {t.demoProposal}
          </a>
          <a href={mailtoLink('Website seperti demo Arunika Rempah')} className="rounded-full bg-[#f7efe2] px-3.5 py-1.5 font-bold text-[#1f140d] no-underline">
            {t.demoContact}
          </a>
        </span>
      </div>
    </div>
  );
}

function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#e0a526" />
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="16" cy="9" rx="2.6" ry="6" fill="#7a3b1f" transform={`rotate(${i * 45} 16 16)`} />
      ))}
      <circle cx="16" cy="16" r="2.6" fill="#f7efe2" />
    </svg>
  );
}

function HeroFallback() {
  return (
    <div className="grid h-full w-full place-items-center">
      <SpiceArt kind="stick" className="w-1/2 opacity-80" />
    </div>
  );
}

