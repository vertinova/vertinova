import { ArrowRight, ArrowUpRight, Gamepad2, Mail, MessageCircle } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { ContactForm } from './ContactForm';
import { COMPANY, PROJECTS, whatsappLink, type Project } from './projects';

const hostOf = (url?: string) => (url ? new URL(url).host : 'segera hadir');
// Back-to-front order of the screenshot stack in the hero.
const HERO_SHOTS = ['dpmd', 'sire', 'simpaskor'].map((id) => PROJECTS.find((p) => p.id === id)).filter((p): p is Project => !!p);
const CARD_POSITIONS = [
  'top-0 right-0 rotate-3 group-hover:translate-x-[4%] group-hover:-translate-y-[4%] group-hover:rotate-5',
  'top-[24%] left-0 -rotate-4 group-hover:-translate-x-[5%] group-hover:-rotate-6',
  'bottom-0 right-[6%] rotate-1 group-hover:translate-x-[2%] group-hover:translate-y-[5%] group-hover:rotate-0',
];

const container = 'mx-auto w-full max-w-[1200px] px-4';
const btn = {
  base: 'inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border-[1.5px] px-[22px] text-[15px] font-bold no-underline transition hover:-translate-y-px max-sm:flex-1 max-sm:basis-full',
  // Each variant sets its own border colour: two border-colour utilities on one element would fight.
  solid: 'border-ink bg-ink text-paper hover:border-teal-700 hover:bg-teal-700',
  line: 'border-ink text-ink',
  light: 'border-paper bg-paper text-ink',
  outlineLight: 'border-paper/40 text-paper hover:border-paper',
};

/** 2D company profile: shown without WebGL, with reduced motion, or on request. Same data as the 3D world. */
export default function LandingLite({ onOpen3D }: { onOpen3D?: () => void }) {
  const wa = whatsappLink('Halo Vertinova, saya ingin ngobrol soal project.');
  return (
    <main className="min-h-screen overflow-x-clip bg-paper font-jakarta text-ink antialiased [text-rendering:auto] [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-amber-500">
      <header className="sticky top-0 z-20 border-b border-stone-300 bg-paper">
        <div className={`${container} flex items-center justify-between gap-3 py-3`}>
          <a className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-ink no-underline" href="/">
            <img src={COMPANY.logo} alt="" className="size-8 object-contain" />
            Vertinova
          </a>
          <nav aria-label="Navigasi utama" className="flex items-center gap-0.5">
            {[
              ['#karya', 'Karya'],
              ['#cara-kerja', 'Cara kerja'],
              ['#kontak', 'Kontak'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-2 text-sm font-semibold text-ink no-underline hover:bg-ink/5 max-sm:hidden">
                {label}
              </a>
            ))}
            {onOpen3D && (
              <button onClick={onOpen3D} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-ink/5">
                <Gamepad2 size={16} /> <span className="max-sm:hidden">Mode 3D</span>
              </button>
            )}
            <a href="/admin" className="ml-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper no-underline hover:bg-teal-800">
              Masuk
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className={`${container} grid items-center gap-10 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24`}>
        <div>
          <h1 className="m-0 font-display text-[clamp(40px,5.4vw,74px)] leading-none font-extrabold tracking-[-0.045em]">
            Sistem digital yang <em className="text-teal-700 not-italic">benar‑benar dipakai</em>.
            <span className="mt-[0.18em] block text-[0.52em] leading-[1.15] font-semibold tracking-[-0.02em] text-muted">Dari kantor dinas sampai kedai kopi.</span>
          </h1>
          <p className="mt-6 mb-7 max-w-[560px] text-base leading-relaxed text-muted sm:text-lg">{COMPANY.intro}</p>
          <div className="flex flex-wrap gap-2.5">
            <a className={`${btn.base} ${btn.solid}`} href="#kontak">
              Ceritakan kebutuhan Anda <ArrowRight size={18} />
            </a>
            <a className={`${btn.base} ${btn.line}`} href="#karya">
              Lihat karya
            </a>
          </div>
          <ul className="mt-10 grid list-none grid-cols-2 gap-x-6 gap-y-5 p-0 sm:grid-cols-3">
            <Fact value={String(PROJECTS.length)} text="sistem yang sedang berjalan dan bisa Anda buka" />
            <Fact value="416" text="desa dikelola dalam satu sistem DPMD" />
            <Fact value="24/7" text="presensi, pesanan, dan penilaian berjalan tiap hari" className="col-span-2 sm:col-span-1" />
          </ul>
        </div>

        <div aria-hidden="true" className="group relative mx-auto aspect-[1/0.92] w-full max-w-[560px] lg:max-w-none">
          {HERO_SHOTS.map((p, i) => (
            <figure
              key={p.id}
              className={`absolute m-0 w-4/5 overflow-hidden rounded-[14px] border border-stone-300 bg-white shadow-[0_24px_48px_-28px_rgba(14,26,22,0.5)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${CARD_POSITIONS[i]}`}
            >
              <BrowserBar host={hostOf(p.url)} />
              <img src={p.images[0].src} alt="" decoding="async" width={1600} height={1000} className="block aspect-[16/10] h-auto w-full object-cover object-top" />
            </figure>
          ))}
        </div>
      </section>

      {/* Running list of project names */}
      <div className={`${container} mt-12 lg:mt-20`} aria-label="Proyek yang sudah berjalan">
        <div className="relative overflow-hidden border-y border-stone-300 py-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-paper to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-paper to-transparent" />
          <ul className="m-0 flex w-max animate-marquee list-none gap-12 p-0 will-change-transform motion-reduce:animate-none">
            {[...PROJECTS, ...PROJECTS].map((p, i) => (
              <li key={`${p.id}-${i}`} aria-hidden={i >= PROJECTS.length} className="flex items-center gap-3 font-display text-[clamp(18px,2.2vw,26px)] font-bold tracking-[-0.02em] whitespace-nowrap">
                <span className="size-2.5 rotate-45 rounded-[3px]" style={{ background: p.color }} />
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Work */}
      <section id="karya" className={`${container} scroll-mt-20 pt-20 lg:pt-32`}>
        <SectionHead index="01 / Karya" title="Beberapa yang sudah berjalan." sub="Bukan mockup. Semua tautan di bawah bisa Anda buka sekarang." />
        <div className="grid gap-14 lg:gap-24">
          {PROJECTS.map((p, i) => (
            <ProjectRow key={p.id} project={p} index={i} />
          ))}
        </div>
      </section>

      {/* How we work */}
      <section id="cara-kerja" className={`${container} scroll-mt-20 pt-20 lg:pt-32`}>
        <SectionHead index="02 / Cara kerja" title="Yang bisa Anda harapkan dari kami." />
        <ol className="m-0 grid list-none border-t border-ink p-0 sm:grid-cols-2 lg:grid-cols-4">
          {COMPANY.strengths.map((s, i) => (
            <li key={s.title} className="border-b border-stone-300 py-6 sm:pr-6 lg:border-b-0 lg:border-l lg:px-6 lg:first:border-l-0 lg:first:pl-0">
              <span className="font-display text-sm font-bold text-teal-700">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-2.5 mb-2 font-display text-[21px] leading-tight font-bold tracking-tight">{s.title}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-9 flex list-none flex-wrap gap-2 p-0" aria-label="Layanan">
          {COMPANY.services.map((s) => (
            <li key={s} className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm font-semibold">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {/* Contact */}
      <div className={`${container} pt-20 lg:pt-32`}>
        <section id="kontak" className="grid scroll-mt-20 items-start gap-8 rounded-[28px] bg-ink p-7 text-paper sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:p-16">
          <div>
            <span className="text-[13px] font-semibold tracking-[0.08em] text-teal-300 uppercase">03 / Kontak</span>
            <h2 className="mt-3 mb-4 font-display text-[clamp(32px,4.6vw,56px)] leading-[1.02] font-extrabold tracking-[-0.035em]">Ada proses yang bikin pusing? Ceritakan saja.</h2>
            <p className="mb-6 text-[17px] leading-relaxed text-stone-300">Kami balas dengan pertanyaan yang jujur dan perkiraan yang masuk akal — tanpa kewajiban apa pun.</p>
            <div className="flex flex-wrap gap-2.5">
              {wa && (
                <a className={`${btn.base} ${btn.light}`} href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} /> WhatsApp
                </a>
              )}
              <a className={`${btn.base} ${btn.outlineLight}`} href={`mailto:${COMPANY.email}`}>
                <Mail size={18} /> {COMPANY.email}
              </a>
            </div>
          </div>
          <ContactForm lite />
        </section>
      </div>

      <footer className={`${container} flex flex-wrap justify-between gap-2 py-10 text-sm text-muted`}>
        <span>© {new Date().getFullYear()} Vertinova</span>
        <a href={`mailto:${COMPANY.email}`} className="font-semibold text-ink">
          {COMPANY.email}
        </a>
      </footer>
    </main>
  );
}

function Fact({ value, text, className = '' }: { value: string; text: string; className?: string }) {
  return (
    <li className={`border-t border-stone-300 pt-4 ${className}`}>
      <strong className="block font-display text-[clamp(26px,2.8vw,36px)] leading-none font-extrabold tracking-[-0.03em]">{value}</strong>
      <span className="mt-1.5 block text-[13.5px] leading-snug text-muted">{text}</span>
    </li>
  );
}

function SectionHead({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <div className="mb-10 grid gap-2.5 lg:mb-16">
      <span className="text-[13px] font-semibold tracking-[0.08em] text-teal-700 uppercase">{index}</span>
      <h2 className="m-0 font-display text-[clamp(32px,4.6vw,56px)] leading-[1.02] font-extrabold tracking-[-0.035em]">{title}</h2>
      {sub && <p className="m-0 text-[17px] text-muted">{sub}</p>}
    </div>
  );
}

function BrowserBar({ host }: { host: string }) {
  return (
    <span className="flex items-center gap-1.5 border-b border-stone-300 bg-[#efede6] px-3.5 py-2.5" aria-hidden="true">
      <i className="size-2.5 rounded-full bg-stone-300" />
      <i className="size-2.5 rounded-full bg-stone-300" />
      <i className="size-2.5 rounded-full bg-stone-300" />
      <b className="ml-2.5 flex-1 truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-muted">{host}</b>
    </span>
  );
}

function ProjectRow({ project: p, index }: { project: Project; index: number }) {
  const host = hostOf(p.url);
  const shot = p.images[0];
  const shotClass = `block overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-[0_18px_36px_-24px_rgba(14,26,22,0.4)] transition-transform duration-300 ${index % 2 ? 'lg:order-2' : ''}`;
  const frame: ReactNode = (
    <>
      <BrowserBar host={host} />
      {shot && <img src={shot.src} alt={shot.alt} loading="lazy" decoding="async" width={1600} height={1000} className="block aspect-[16/10] h-auto w-full object-cover object-top" />}
    </>
  );
  return (
    <article className="grid items-center gap-7 lg:grid-cols-[1.25fr_1fr] lg:gap-16" style={{ '--accent': p.color } as CSSProperties}>
      {p.url ? (
        <a className={`${shotClass} hover:-translate-y-1`} href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${p.name} di tab baru`}>
          {frame}
        </a>
      ) : (
        <div className={shotClass}>{frame}</div>
      )}
      <div>
        <p className="m-0 flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.07em] text-muted uppercase">
          <span className="rounded-md bg-(--accent) px-2 py-0.5 text-white">{String(index + 1).padStart(2, '0')}</span>
          {p.category}
        </p>
        <h3 className="mt-3.5 mb-1 font-display text-[clamp(28px,3.4vw,42px)] leading-[1.05] font-extrabold tracking-[-0.03em]">{p.name}</h3>
        <p className="mt-0 mb-3.5 text-[15px] text-muted">{p.client}</p>
        <p className="m-0 text-[16.5px] leading-relaxed">{p.description}</p>
        <ul className="my-5 grid list-none gap-2 p-0">
          {p.features.slice(0, 4).map((f) => (
            <li
              key={f}
              className="relative pl-5 text-[15px] leading-snug text-ink/85 before:absolute before:top-[0.45em] before:left-0.5 before:size-2 before:rotate-45 before:rounded-[2px] before:bg-(--accent) before:content-['']"
            >
              {f}
            </li>
          ))}
        </ul>
        {p.url && (
          <a className="inline-flex items-center gap-1.5 border-b-2 border-(--accent) pb-0.5 font-bold text-ink no-underline hover:text-(--accent)" href={p.url} target="_blank" rel="noopener noreferrer">
            {host} <ArrowUpRight size={16} />
          </a>
        )}
      </div>
    </article>
  );
}
