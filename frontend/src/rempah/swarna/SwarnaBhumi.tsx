import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { Check, ChevronDown, ClipboardCheck, FileText, Globe2, Leaf, Mail, MapPin, Package, Ship, Sprout } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CATEGORIES, COPY, DOCS, FACT_VALUES, FORMS, LANG_NAMES, PRODUCTS, type Category } from './content';
import { countryLang, initialLang, LANGS, saveLang, type Lang } from './lang';

// Company profile for PT Swarnabhumi Global Nusantara (spice commodities), previewed at vertinova.id/rempah.
// Audience skews older: large type, high contrast, big buttons, WhatsApp always in reach.
const EMAIL = 'contact@swarnabhumi.com';
const WHATSAPP = '62816666997'; // +62 816-666-997, wa.me format (no "+")
const PHONE = '+62 816-666-997';
const NAME = 'PT Swarnabhumi Global Nusantara';
const waLink = (text: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

const IMG = '/rempah';
const wrap = 'mx-auto w-full max-w-[1200px] px-4 sm:px-6';
const serif = "font-['Fraunces',ui-serif,Georgia,serif]";
// Logo colours: brown earth, leaf green, saffron orange.
const C = { brown: '#4a230d', ink: '#2b1407', green: '#4a9e22', greenText: '#2f7a17', orange: '#f07c19', orangeText: '#b4520b', cream: '#fbf8f2' };
const h2 = `${serif} mt-3 mb-0 text-[clamp(32px,4.2vw,52px)] leading-[1.08] font-semibold tracking-[-0.01em]`;
const kicker = 'm-0 inline-flex items-center gap-2 text-[14px] font-bold tracking-[0.14em] uppercase';
const btn = 'inline-flex min-h-[56px] items-center justify-center gap-2.5 rounded-full px-7 text-[17px] font-bold no-underline transition';

export default function SwarnaBhumi() {
  const init = useRef<{ lang: Lang; fixed: boolean }>(null!);
  init.current ??= initialLang();
  const [lang, setLang] = useState<Lang>(init.current.lang);
  const [cat, setCat] = useState<'all' | Category>('all');
  const t = COPY[lang];
  const rtl = lang === 'ar';
  const wa = waLink(t.waHello);
  const products = cat === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);

  // Visitor country decides the language unless the visitor (or ?lang=) already chose one.
  useEffect(() => {
    if (init.current.fixed) return;
    countryLang().then((l) => l && !init.current.fixed && setLang(l));
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = rtl ? 'rtl' : 'ltr';
    document.title = `${NAME} · ${t.kicker}`;
  }, [lang, rtl, t.kicker]);

  useEffect(() => {
    const font = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&display=swap' });
    const robots = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' }); // preview on Vertinova's domain
    document.head.append(font, robots);
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      font.remove();
      robots.remove();
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  const choose = (l: Lang) => {
    init.current.fixed = true;
    saveLang(l);
    setLang(l);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main dir={rtl ? 'rtl' : 'ltr'} style={{ background: C.cream, color: C.ink }} className="min-h-screen overflow-x-clip font-jakarta text-[17px] antialiased [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-[#f07c19]">
        <style>{'@keyframes sb-marquee{to{transform:translateX(-50%)}}'}</style>

        {/* Header: solid white so the full-colour logo always reads */}
        <header className="fixed inset-x-0 top-0 z-30 border-b border-black/10 bg-white/95 backdrop-blur">
          <div className={`${wrap} flex h-[76px] items-center gap-6`}>
            <a href="#top" className="no-underline" aria-label={NAME}>
              <Logo />
            </a>
            <nav className="ms-auto flex items-center gap-8 text-[16px] font-semibold max-lg:hidden">
              {(['about', 'products', 'process', 'contact'] as const).map((k) => (
                <a key={k} href={`#${k}`} className="text-inherit no-underline hover:text-[#b4520b]">
                  {t.nav[k]}
                </a>
              ))}
            </nav>
            <LangPicker lang={lang} label={t.language} onChange={choose} />
          </div>
        </header>

        {/* Hero */}
        <section id="top" className="relative overflow-hidden pt-[76px] text-white" style={{ background: C.ink }}>
          <img src={`${IMG}/hero.webp`} alt="" width={1600} height={900} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(43,20,7,0.94)_0%,rgba(43,20,7,0.75)_45%,rgba(43,20,7,0.25)_100%)] rtl:bg-[linear-gradient(260deg,rgba(43,20,7,0.94)_0%,rgba(43,20,7,0.75)_45%,rgba(43,20,7,0.25)_100%)]" />
          <div className={`${wrap} relative pt-12 pb-32 sm:pt-24 sm:pb-44`}>
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-bold tracking-[0.08em] uppercase" style={{ background: C.orange, color: C.ink }}>
                <Leaf size={16} /> {t.kicker}
              </span>
              <h1 className={`${serif} mt-6 mb-0 max-w-[820px] text-[clamp(34px,6.2vw,80px)] leading-[1.04] font-semibold tracking-[-0.015em]`}>{t.title}</h1>
              <p className="mt-6 mb-0 max-w-[620px] text-[19px] leading-relaxed text-white/90 sm:text-[21px]">{t.lead}</p>
            </div>
          </div>
        </section>

        {/* Facts card overlapping the hero (no reveal: above the fold) */}
        <div className={`${wrap} relative z-10 -mt-24`}>
          <div>
            <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-3xl bg-white shadow-[0_30px_60px_-30px_rgba(43,20,7,0.45)] lg:grid-cols-4">
              {t.facts.map((label, i) => (
                <div key={label} className="border-black/10 p-6 sm:p-8 [&:nth-child(-n+2)]:max-lg:border-b [&:nth-child(odd)]:max-lg:border-e lg:[&:not(:last-child)]:border-e">
                  <dt className={`${serif} text-[clamp(24px,3.4vw,44px)] leading-none font-bold whitespace-nowrap`} style={{ color: i % 2 ? C.greenText : C.orangeText }}>
                    {FACT_VALUES[i]}
                  </dt>
                  <dd className="m-0 mt-3 text-[16px] font-semibold text-black/75">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Moving strip of commodity names */}
        <div className="mt-16 overflow-hidden py-5 text-white" style={{ background: C.brown }} aria-hidden="true" dir="ltr">
          <div className="flex w-max animate-[sb-marquee_45s_linear_infinite] gap-10 motion-reduce:animate-none">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 gap-10">
                {PRODUCTS.map((p) => (
                  <span key={p.id} className={`${serif} flex items-center gap-10 text-[24px] font-medium whitespace-nowrap`}>
                    {p.name[lang]} <span style={{ color: C.orange }}>✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <section id="about" className={`${wrap} grid scroll-mt-20 items-center gap-12 py-16 sm:py-32 lg:grid-cols-2 lg:gap-20`}>
          <Reveal className="relative">
            <img src={`${IMG}/about.webp`} alt="" width={1000} height={750} loading="lazy" className="aspect-[4/3] w-full rounded-3xl object-cover" />
            <div className="absolute -bottom-6 end-4 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_20px_40px_-20px_rgba(43,20,7,0.5)] sm:end-8">
              <MapPin size={26} style={{ color: C.greenText }} />
              <span>
                <strong className={`${serif} block text-[26px] leading-none`}>{FACT_VALUES[1]}</strong>
                <span className="text-[15px] font-semibold text-black/70">{t.facts[1]}</span>
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className={kicker} style={{ color: C.greenText }}>
              <Sprout size={18} /> {t.aboutKicker}
            </p>
            <h2 className={h2}>{t.aboutTitle}</h2>
            <p className="mt-6 mb-0 text-[18px] leading-relaxed text-black/80">{t.aboutText}</p>
            <ul className="mt-9 mb-0 grid list-none gap-6 p-0">
              {t.points.map(([title, text], i) => {
                const Icon = [Sprout, ClipboardCheck, Ship][i];
                return (
                  <li key={title} className="flex gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: i === 1 ? C.orange : C.green }}>
                      <Icon size={26} />
                    </span>
                    <span>
                      <strong className="block text-[19px]">{title}</strong>
                      <span className="text-[17px] text-black/75">{text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </section>

        {/* Products */}
        <section id="products" className="scroll-mt-20 bg-white py-16 sm:py-32">
          <div className={wrap}>
            <Reveal className="mx-auto max-w-[760px] text-center">
              <p className={`${kicker} justify-center`} style={{ color: C.orangeText }}>
                <Leaf size={18} /> {t.productsKicker}
              </p>
              <h2 className={h2}>{t.productsTitle}</h2>
              <p className="mt-5 mb-0 text-[18px] leading-relaxed text-black/75">{t.productsText}</p>
            </Reveal>
            <div className="-mx-4 mt-8 flex gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-10 sm:flex-wrap sm:justify-center sm:gap-3 sm:px-0" role="tablist" aria-label={t.productsTitle}>
              {(['all', ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={cat === c}
                  onClick={() => setCat(c)}
                  className={`min-h-[50px] shrink-0 cursor-pointer rounded-full border-2 px-5 whitespace-nowrap sm:px-6 text-[16px] font-bold transition ${cat === c ? 'border-transparent text-white' : 'border-black/15 bg-white text-inherit hover:border-black/40'}`}
                  style={cat === c ? { background: C.brown } : undefined}
                >
                  {c === 'all' ? t.all : t.cats[c]}
                </button>
              ))}
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <motion.article
                  layout
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-black/10 bg-[#fbf8f2] transition-shadow hover:shadow-[0_30px_50px_-30px_rgba(43,20,7,0.5)]"
                >
                  <div className="relative overflow-hidden">
                    <img src={`${IMG}/${p.id}.webp`} alt={p.name[lang]} width={960} height={720} loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform sm:aspect-[4/3] duration-700 group-hover:scale-110" />
                    <span className="absolute start-4 bottom-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 text-[14px] font-bold">
                      <MapPin size={15} style={{ color: C.greenText }} />
                      <bdi dir="ltr">{p.origin}</bdi>
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className={`${serif} m-0 text-[26px] leading-tight font-semibold`}>{p.name[lang]}</h3>
                    <p className={`${serif} mt-1 mb-0 text-[16px] text-black/65 italic`}>
                      <bdi>{p.latin}</bdi>
                    </p>
                    <dl className="mt-5 mb-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 border-t border-black/10 pt-5 text-[15px]">
                      {(
                        [
                          [t.spec.forms, p.forms.map((f) => FORMS[f][lang]).join(' · ')],
                          [t.spec.grade, p.grade],
                          [t.spec.moisture, p.moisture],
                          [t.spec.hs, p.hs],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="text-black/65">{label}</dt>
                          <dd className="m-0 font-bold">
                            {/* only Forms is translated; the rest are codes/numbers that must read LTR (e.g. "≤ 13%") */}
                            <bdi dir={label === t.spec.forms ? undefined : 'ltr'}>{value}</bdi>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </motion.article>
              ))}
            </div>
            <p className="mt-8 mb-0 text-center text-[16px] text-black/65">{t.specNote}</p>
          </div>
        </section>

        {/* Process */}
        <section id="process" className="relative scroll-mt-20 overflow-hidden py-16 text-white sm:py-32" style={{ background: C.ink }}>
          <div className={`${wrap} relative`}>
            <Reveal className="max-w-[760px]">
              <p className={kicker} style={{ color: C.orange }}>
                <Ship size={18} /> {t.processKicker}
              </p>
              <h2 className={h2}>{t.processTitle}</h2>
            </Reveal>
            <ol className="mt-10 mb-0 grid list-none gap-4 p-0 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              {t.steps.map(([title, text], i) => {
                const Icon = [Sprout, Leaf, ClipboardCheck, Ship][i];
                return (
                  <motion.li
                    key={title}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                    className="h-full rounded-3xl border border-white/10 bg-white/[0.05] p-5 sm:p-7"
                  >
                      <div className="flex items-center justify-between">
                        <span className={`${serif} text-[38px] leading-none font-bold sm:text-[48px]`} style={{ color: C.orange }}>
                          0{i + 1}
                        </span>
                        <Icon size={30} className="text-[#7cc957]" />
                      </div>
                      <strong className="mt-6 block text-[21px]">{title}</strong>
                      <p className="mt-2 mb-0 text-[17px] leading-relaxed text-white/80">{text}</p>
                  </motion.li>
                );
              })}
            </ol>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
              <Reveal className="flex gap-4 rounded-3xl bg-white p-7 text-[#2b1407]">
                <Package size={30} className="shrink-0" style={{ color: C.orangeText }} />
                <div>
                  <strong className="text-[19px]">{t.packingTitle}</strong>
                  <p className="mt-2 mb-0 text-[17px] leading-relaxed text-black/75">{t.packingText}</p>
                </div>
              </Reveal>
              <Reveal delay={0.08} className="flex gap-4 rounded-3xl bg-white p-7 text-[#2b1407]">
                <FileText size={30} className="shrink-0" style={{ color: C.greenText }} />
                <div>
                  <strong className="text-[19px]">{t.docsTitle}</strong>
                  <ul className="mt-3 mb-0 flex list-none flex-wrap gap-2 p-0" dir="ltr">
                    {DOCS.map((d) => (
                      <li key={d} className="rounded-full bg-[#4a9e22]/12 px-3.5 py-1.5 text-[15px] font-semibold text-[#225c10]">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="relative scroll-mt-20 overflow-hidden py-16 text-white sm:py-32">
          <img src={`${IMG}/cloves.webp`} alt="" width={960} height={720} loading="lazy" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'rgba(43,20,7,0.88)' }} />
          <Reveal className={`${wrap} relative text-center`}>
            <p className={`${kicker} justify-center`} style={{ color: C.orange }}>
              <Mail size={18} /> {t.contactKicker}
            </p>
            <h2 className={`${h2} mx-auto max-w-[820px]`}>{t.contactTitle}</h2>
            <p className="mx-auto mt-6 mb-0 max-w-[620px] text-[19px] leading-relaxed text-white/85">{t.contactText}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a href={wa} target="_blank" rel="noreferrer" className={`${btn} min-h-[64px] bg-[#25d366] px-9 text-[19px] text-[#0b2e14] hover:bg-[#3ee07a] max-sm:w-full`}>
                <WhatsAppIcon className="size-7" /> {t.waCta}
              </a>
              <a href={`mailto:${EMAIL}`} className={`${btn} min-h-[64px] border-2 border-white/60 px-9 text-[19px] text-white hover:border-white max-sm:w-full`}>
                <Mail size={22} /> {t.emailCta}
              </a>
            </div>
            <ul className="mx-auto mt-10 mb-0 flex max-w-[860px] list-none flex-wrap justify-center gap-x-10 gap-y-4 p-0 text-[17px] text-white/90">
              <li className="inline-flex items-center gap-2.5">
                <WhatsAppIcon className="size-5 text-[#7cc957]" />
                <bdi dir="ltr" className="font-bold">
                  {PHONE}
                </bdi>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <Mail size={20} className="text-[#7cc957]" />
                <bdi dir="ltr" className="font-bold">
                  {EMAIL}
                </bdi>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <MapPin size={20} className="text-[#7cc957]" />
                {t.office}: <strong>Indonesia</strong>
              </li>
            </ul>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="bg-white pt-12 pb-28 text-[16px] sm:pb-12">
          <div className={`${wrap} flex flex-wrap items-center justify-between gap-6`}>
            <Logo />
            <p className="m-0 text-black/70">{t.footerTag}</p>
          </div>
          <div className={`${wrap} mt-8 flex flex-wrap justify-between gap-4 border-t border-black/10 pt-6 text-[14px] text-black/60`}>
            <span>
              © {new Date().getFullYear()} {NAME}
            </span>
          </div>
        </footer>

        {/* Floating WhatsApp, bottom-right with a visible label */}
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${PHONE}`}
          className="fixed right-4 bottom-4 z-40 inline-flex size-16 items-center justify-center gap-2.5 rounded-full bg-[#25d366] sm:size-auto sm:min-h-[60px] sm:ps-4 sm:pe-6 text-[17px] font-bold text-[#0b2e14] no-underline shadow-[0_14px_34px_-10px_rgba(0,0,0,0.5)] transition hover:scale-105 sm:right-6 sm:bottom-6"
        >
          <WhatsAppIcon className="size-9 sm:size-8" /> <span className="max-sm:hidden">WhatsApp</span>
        </a>
      </main>
    </MotionConfig>
  );
}

const LANG_EN: Record<Lang, string> = { en: 'English', id: 'Indonesian', zh: 'Chinese', ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese' };

/** Styled language menu (a native <select> popup can't be styled): button + listbox with arrow keys, Enter, Esc, click-outside. */
function LangPicker({ lang, label, onChange }: { lang: Lang; label: string; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const outside = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (l: Lang) => {
    onChange(l);
    close();
  };
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (move) {
      e.preventDefault();
      items[(i + move + items.length) % items.length]?.focus();
    } else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="relative shrink-0 max-lg:ms-auto">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${LANG_NAMES[lang]}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-white px-3.5 text-[15px] font-bold text-inherit transition ${open ? 'border-[#4a9e22] shadow-[0_0_0_4px_rgba(74,158,34,0.15)]' : 'border-[#2f7a17]/30 hover:border-[#4a9e22]'}`}
      >
        <Globe2 size={18} className="text-[#2f7a17]" />
        <span className="sm:hidden">{lang.toUpperCase()}</span>
        <span className="max-sm:hidden">{LANG_NAMES[lang]}</span>
        <ChevronDown size={16} className={`text-black/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute end-0 top-full z-50 mt-3 w-[min(300px,calc(100vw-32px))] origin-top-right overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_30px_60px_-20px_rgba(43,20,7,0.45)] rtl:origin-top-left"
          >
            <div className="flex items-center gap-2 border-b border-black/10 bg-[#fbf8f2] px-5 py-3.5 text-[13px] font-bold tracking-[0.12em] text-[#2f7a17] uppercase">
              <Globe2 size={16} /> {label}
            </div>
            <ul ref={list} role="listbox" aria-label={label} onKeyDown={onKey} className="m-0 grid list-none gap-0.5 p-2">
              {LANGS.map((l) => {
                const active = l === lang;
                return (
                  <li
                    key={l}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    lang={l}
                    onClick={() => pick(l)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        pick(l);
                      }
                    }}
                    className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-2xl px-3 outline-none transition-colors focus-visible:bg-[#4a9e22]/10 ${active ? 'bg-[#4a9e22]/12' : 'hover:bg-black/[0.04]'}`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold tracking-wide ${active ? 'bg-[#4a9e22] text-white' : 'bg-[#f07c19]/12 text-[#b4520b]'}`} dir="ltr">
                      {l.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[16px] font-bold">{LANG_NAMES[l]}</span>
                      <span className="block text-[13px] text-black/55" lang="en">
                        {LANG_EN[l]}
                      </span>
                    </span>
                    {active && <Check size={20} className="shrink-0 text-[#2f7a17]" />}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.6, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

/** Mark + wordmark, redrawn from the client's logo. shortcut: SVG approximation; replace with the original logo file when supplied. */
function Logo() {
  const clip = `sb${useId().replace(/[^\w-]/g, '')}`; // logo renders twice; ids must be unique and url()-safe
  return (
    <span className="flex items-center gap-3" dir="ltr">
      <svg viewBox="0 0 100 100" className="size-10 shrink-0 sm:size-12" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <circle cx="50" cy="52" r="46" />
          </clipPath>
        </defs>
        <path d="M13 42A40 40 0 0 1 87 42" fill="none" stroke={C.brown} strokeWidth="7" />
        <path d="M50 22c7 7 13 16 13 30h-7c0-9-2-15-6-20-4 5-6 11-6 20h-7c0-14 6-23 13-30z" fill={C.orange} />
        <path d="M4 50c18-4 36 4 43 24C30 75 11 68 4 50z" fill={C.green} />
        <path d="M96 50c-18-4-36 4-43 24 17 1 36-6 43-24z" fill={C.green} />
        <path d="M11 55c14 2 26 8 34 17M89 55c-14 2-26 8-34 17" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <g clipPath={`url(#${clip})`}>
          <path d="M0 77c24-5 38 9 58 5 15-3 27-9 42-7v30H0z" fill={C.brown} />
          <path d="M8 90c20-9 42 6 64-3 10-4 18-5 26-3" fill="none" stroke="#fff" strokeWidth="3.5" />
        </g>
      </svg>
      <span className="leading-none">
        <span className={`${serif} block text-[18px] font-bold tracking-[0.04em] sm:text-[21px]`} style={{ color: C.brown }}>
          SWARNABHUMI
        </span>
        <span className="mt-1 block text-[11px] font-semibold tracking-[0.12em] sm:text-[13px]" style={{ color: C.greenText }}>
          GLOBAL NUSANTARA
        </span>
      </span>
    </span>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}
