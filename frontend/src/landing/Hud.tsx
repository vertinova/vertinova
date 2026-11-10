import { useProgress } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ExternalLink,
  Gauge,
  HelpCircle,
  LayoutList,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContactForm } from './ContactForm';
import { COMPANY, PROJECTS, mailtoLink, projectById, whatsappLink } from './projects';
import { car, commands, input, leaveStation, store, useGame, type Quality } from './store';
import { ROUTE_COUNT, STATIONS, routeX, routeZ, stationLayout } from './layout';

const PROJECT_STATIONS = STATIONS.filter((s) => s.kind === 'project');
const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

function useKeyboard() {
  useEffect(() => {
    const keyMap: Record<string, keyof typeof input> = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'handbrake',
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const key = keyMap[e.code];
      const { phase } = store.get();
      if (key && phase === 'driving') {
        (input[key] as boolean) = true;
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyR' && phase === 'driving') commands.reset = true;
      if (e.code === 'KeyC') store.set((s) => ({ camera: s.camera === 'chase' ? 'top' : 'chase' }));
      if (e.code === 'KeyM') store.set((s) => ({ muted: !s.muted }));
      if (e.code === 'KeyH' || e.key === '?') store.set((s) => ({ help: !s.help }));
      if (e.code === 'Escape') {
        if (store.get().help) store.set({ help: false });
        else if (phase === 'station') leaveStation();
      }
      if ((e.code === 'Enter' || e.code === 'Space') && phase === 'intro') {
        e.preventDefault();
        store.set({ phase: 'driving' });
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = keyMap[e.code];
      if (key) (input[key] as boolean) = false;
    };
    const blur = () => Object.assign(input, { up: false, down: false, left: false, right: false, handbrake: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
}

/** Synth engine: two detuned oscillators, pitch follows speed. Created on first unmute (needs a user gesture). */
function useEngineSound(muted: boolean) {
  const audio = useRef<{ ctx: AudioContext; gain: GainNode; oscs: OscillatorNode[]; filter: BiquadFilterNode } | null>(null);
  useEffect(() => {
    if (muted) {
      audio.current?.gain.gain.setTargetAtTime(0, audio.current.ctx.currentTime, 0.1);
      return;
    }
    if (!audio.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      gain.gain.value = 0;
      const oscs = (['sawtooth', 'square'] as OscillatorType[]).map((type, i) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = 50 + i * 1.5;
        o.connect(filter);
        o.start();
        return o;
      });
      filter.connect(gain).connect(ctx.destination);
      audio.current = { ctx, gain, oscs, filter };
    }
    void audio.current.ctx.resume();
    let raf = 0;
    const loop = () => {
      const a = audio.current!;
      const speed = Math.abs(car.speed);
      const gearSpeed = speed % 9; // fake gear shifts
      const f = 42 + gearSpeed * 7 + speed * 1.4;
      a.oscs.forEach((o, i) => o.frequency.setTargetAtTime(f * (i ? 1.01 : 1), a.ctx.currentTime, 0.05));
      a.filter.frequency.setTargetAtTime(380 + Math.abs(car.throttle) * 700 + speed * 12, a.ctx.currentTime, 0.08);
      a.gain.gain.setTargetAtTime(0.035 + Math.abs(car.throttle) * 0.03, a.ctx.currentTime, 0.1);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [muted]);
  useEffect(() => () => void audio.current?.ctx.close(), []);
}

function LoadingScreen() {
  const { progress } = useProgress();
  const phase = useGame((s) => s.phase);
  return (
    <AnimatePresence>
      {phase === 'loading' && (
        <motion.div className="vx-loading" exit={{ opacity: 0, pointerEvents: 'none' }} transition={{ duration: 0.6 }}>
          <img src={COMPANY.logo} alt="" />
          <strong>Menyiapkan dunia Vertinova…</strong>
          <div className="vx-progress">
            <span style={{ width: `${Math.max(8, progress)}%` }} />
          </div>
          <small>Membangun jalan, sawah, dan pos-pos proyek</small>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Intro({ onLite }: { onLite: () => void }) {
  const phase = useGame((s) => s.phase);
  const touch = useIsTouch();
  return (
    <AnimatePresence>
      {phase === 'intro' && (
        <motion.div key="intro" className="vx-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
          <motion.section
            className="vx-modal vx-intro"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vx-intro-title"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <div className="vx-intro-brand">
              <img src={COMPANY.logo} alt="" />
              <span>Vertinova · Technology Partner</span>
            </div>
            <h1 id="vx-intro-title">Jelajahi karya kami dengan jeep offroad.</h1>
            <p className="vx-lead">{COMPANY.intro}</p>
            <ol className="vx-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Kemudikan</strong>
                  <small>Jeep 4x4 menyusuri jalur tanah, lumpur, dan jembatan kayu</small>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Singgah di pos</strong>
                  <small>Mobil berhenti sendiri di 6 pos, cerita proyek langsung muncul</small>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Ngobrol dengan kami</strong>
                  <small>Pos Kontak menunggu di ujung jalur</small>
                </div>
              </li>
            </ol>
            <div className="vx-keys">
              {touch ? (
                <span>
                  <Navigation size={14} /> Geser analog di kiri bawah: atas = gas, bawah = rem/mundur, kiri-kanan = belok
                </span>
              ) : (
                <>
                  <span>
                    <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mengemudi
                  </span>
                  <span>
                    <kbd>Spasi</kbd> rem tangan
                  </span>
                  <span>
                    <kbd>R</kbd> reset
                  </span>
                  <span>
                    <kbd>C</kbd> lihat peta
                  </span>
                </>
              )}
            </div>
            <footer className="vx-modal-foot">
              <button className="vx-btn ghost" onClick={onLite}>
                <LayoutList size={18} /> Lihat versi ringkas
              </button>
              <button className="vx-btn primary" onClick={() => store.set({ phase: 'driving' })} autoFocus>
                Mulai Jelajah <ArrowRight size={18} />
              </button>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Gallery({ images, color }: { images: { src: string; alt: string }[]; color: string }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return null;
  const image = images[index % images.length];
  return (
    <div className="vx-gallery">
      <div className="vx-gallery-main" style={{ background: `radial-gradient(circle at 50% 40%, ${color}33, #06140f 75%)` }}>
        <AnimatePresence mode="wait">
          <motion.img key={image.src} src={image.src} alt={image.alt} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} transition={{ duration: 0.2 }} />
        </AnimatePresence>
      </div>
      {images.length > 1 && (
        <div className="vx-thumbs" role="tablist" aria-label="Galeri">
          {images.map((img, i) => (
            <button key={img.src} role="tab" aria-selected={i === index} aria-label={img.alt} className={i === index ? 'active' : ''} onClick={() => setIndex(i)}>
              <img src={img.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type PanelContent = { eyebrow: string; title: string; subtitle?: string; color: string; media?: ReactNode; body: ReactNode; actions?: ReactNode };

function projectContent(id: string): PanelContent {
  const project = projectById(id)!;
  const station = STATIONS.find((s) => s.id === id)!;
  return {
    eyebrow: `${station.label.split('·')[0].trim()} · ${project.category}`,
    title: project.name,
    subtitle: project.client,
    color: project.color,
    media: <Gallery images={project.images} color={project.color} />,
    body: (
      <>
        <p className="vx-lead">{project.description}</p>
        <h3 className="vx-subhead">Fitur utama</h3>
        <ul className="vx-features">
          {project.features.map((f) => (
            <li key={f}>
              <CheckCircle2 size={16} style={{ color: project.color }} /> <span>{f}</span>
            </li>
          ))}
        </ul>
        {project.users && (
          <p className="vx-users">
            <b>Dipakai oleh</b> {project.users}
          </p>
        )}
      </>
    ),
    actions: (
      <>
        {project.url ? (
          <a className="vx-btn ghost" href={project.url} target="_blank" rel="noopener noreferrer">
            Kunjungi Website <ExternalLink size={16} />
          </a>
        ) : (
          <span className="vx-btn disabled">Tautan segera hadir</span>
        )}
        <a className="vx-btn ghost" href={mailtoLink(`Ingin sistem seperti ${project.name}`)}>
          <Mail size={16} /> Mau yang seperti ini
        </a>
      </>
    ),
  };
}

const aboutContent = (): PanelContent => ({
  eyebrow: 'Gerbang Vertinova',
  title: 'Partner teknologi yang mengerjakan sampai tuntas.',
  color: '#2dd4bf',
  body: (
    <>
      <p className="vx-lead">{COMPANY.intro}</p>
      <div className="vx-strengths">
        {COMPANY.strengths.map((s) => (
          <div key={s.title}>
            <strong>{s.title}</strong>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
      <div className="vx-chips">
        {COMPANY.services.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </>
  ),
});

function contactContent(): PanelContent {
  const wa = whatsappLink('Halo Vertinova, saya tertarik bekerja sama.');
  return {
    eyebrow: 'Pos Kontak',
    title: 'Mari wujudkan sistem digital Anda.',
    color: '#38bdf8',
    body: (
      <div className="vx-contact">
        <div>
          <p className="vx-lead">Ceritakan kebutuhan instansi atau organisasi Anda — kami bantu dari konsultasi, desain, pengembangan, hingga pendampingan setelah rilis.</p>
          <div className="vx-actions">
            {wa && (
              <a className="vx-btn ghost" href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            <a className="vx-btn ghost" href={`mailto:${COMPANY.email}`}>
              <Mail size={16} /> {COMPANY.email}
            </a>
          </div>
        </div>
        <ContactForm />
      </div>
    ),
  };
}

function StationPanel() {
  const phase = useGame((s) => s.phase);
  const active = useGame((s) => s.activeStation);
  const visited = useGame((s) => s.visited);
  const ref = useRef<HTMLElement>(null);
  const open = phase === 'station' && !!active;
  const station = STATIONS.find((s) => s.id === active);
  const nextProject = PROJECT_STATIONS.find((s) => !visited.includes(s.id));
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open, active]);
  const content = station ? (station.kind === 'project' ? projectContent(station.id) : station.kind === 'contact' ? contactContent() : aboutContent()) : null;
  const nextLabel = nextProject ? `Lanjut ke ${nextProject.label.split('·')[0].trim()}` : station?.kind === 'contact' ? 'Lanjut menjelajah' : 'Lanjut ke Pos Kontak';
  return (
    <AnimatePresence>
      {open && station && content && (
        <motion.div key="backdrop" className="vx-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={leaveStation}>
          <motion.aside
            key={station.id}
            ref={ref}
            tabIndex={-1}
            className={`vx-modal ${content.media ? 'has-media' : ''}`}
            style={{ '--vx-modal-accent': content.color } as React.CSSProperties}
            role="dialog"
            aria-modal="true"
            aria-labelledby="vx-modal-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <header className="vx-modal-head">
              <div>
                <span className="vx-eyebrow">{content.eyebrow}</span>
                <h2 id="vx-modal-title">{content.title}</h2>
                {content.subtitle && <p className="vx-client">{content.subtitle}</p>}
              </div>
              <button className="vx-close" onClick={leaveStation} aria-label="Tutup dan lanjut mengemudi">
                <X size={18} />
              </button>
            </header>
            <div className="vx-modal-body">
              {content.media && <div className="vx-modal-media">{content.media}</div>}
              <div className="vx-modal-info">{content.body}</div>
            </div>
            <footer className="vx-modal-foot">
              <div className="vx-modal-actions">{content.actions}</div>
              <button className="vx-btn primary" onClick={leaveStation}>
                {nextLabel} <ArrowRight size={18} />
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Minimap() {
  const marker = useRef<SVGGElement>(null);
  const visited = useGame((s) => s.visited);
  const path = useMemo(() => {
    let d = '';
    for (let i = 0; i < ROUTE_COUNT; i += 4) d += `${i ? 'L' : 'M'}${routeX[i].toFixed(1)} ${routeZ[i].toFixed(1)}`;
    return `${d}Z`;
  }, []);
  const stations = useMemo(() => STATIONS.map((s) => ({ s, l: stationLayout(s) })), []);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const angle = (Math.atan2(car.forward.z, car.forward.x) * 180) / Math.PI;
      marker.current?.setAttribute('transform', `translate(${car.position.x.toFixed(1)} ${car.position.z.toFixed(1)}) rotate(${angle.toFixed(1)})`);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <nav className="vx-minimap" aria-label="Peta mini — klik pos untuk langsung ke sana">
      <svg viewBox="-118 -118 236 236" role="img" aria-hidden="false">
        <rect x="-118" y="-118" width="236" height="236" rx="22" fill="#3f6f3a" />
        <path d={path} fill="none" stroke="#f1f5f9" strokeOpacity="0.9" strokeWidth="8" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#475569" strokeWidth="5" strokeLinejoin="round" />
        {stations.map(({ s, l }) => (
          <g
            key={s.id}
            className="vx-mm-station"
            transform={`translate(${l.center.x} ${l.center.z})`}
            onClick={() => {
              if (store.get().phase === 'driving' || store.get().phase === 'station') commands.teleport = s.id;
            }}
            role="button"
            tabIndex={0}
            aria-label={`Pergi ke ${s.label}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commands.teleport = s.id;
            }}
          >
            <circle r="10" fill={visited.includes(s.id) ? '#94a3b8' : s.color} stroke="#fff" strokeWidth="2.5" />
            <text y="4.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
              {s.short}
            </text>
          </g>
        ))}
        <g ref={marker}>
          <path d="M9 0 L-6 -6 L-2.5 0 L-6 6 Z" fill="#facc15" stroke="#0f172a" strokeWidth="2" />
        </g>
      </svg>
    </nav>
  );
}

function Speedometer() {
  const value = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const kmh = Math.round(Math.abs(car.speed) * 3.6);
      if (value.current) value.current.textContent = String(kmh);
      if (bar.current) bar.current.style.width = `${Math.min(100, (kmh / 90) * 100)}%`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="vx-speed" aria-hidden="true">
      <Gauge size={18} />
      <span ref={value} className="vx-speed-value">0</span>
      <small>km/j</small>
      <div className="vx-speed-bar">
        <span ref={bar} />
      </div>
    </div>
  );
}

function NextTarget() {
  const visited = useGame((s) => s.visited);
  const phase = useGame((s) => s.phase);
  const arrow = useRef<SVGSVGElement>(null);
  const dist = useRef<HTMLSpanElement>(null);
  const target = PROJECT_STATIONS.find((s) => !visited.includes(s.id)) ?? STATIONS.find((s) => s.id === 'contact')!;
  const center = useMemo(() => stationLayout(target).position, [target]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const dx = center.x - car.position.x;
      const dz = center.z - car.position.z;
      // Camera never rotates (screen up = -Z), so the arrow points in screen space.
      const deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
      if (arrow.current) arrow.current.style.transform = `rotate(${deg.toFixed(0)}deg)`;
      if (dist.current) dist.current.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [center]);
  if (phase !== 'driving' && phase !== 'arriving') return null;
  return (
    <div className="vx-next" role="status">
      <svg ref={arrow} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 2 L20 20 L12 15 L4 20 Z" fill="currentColor" />
      </svg>
      <div>
        <small>Tujuan berikutnya</small>
        <strong>{target.label}</strong>
      </div>
      <span ref={dist} className="vx-next-dist" />
    </div>
  );
}

const TOUCH_QUERY = '(pointer: coarse), (max-width: 760px)';

/** Phones/tablets (or any narrow screen) get the analog stick instead of the minimap. */
function useIsTouch() {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia(TOUCH_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(TOUCH_QUERY);
    const update = () => setTouch(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return touch;
}

const STICK_RADIUS = 52;
const DEADZONE = 0.12;

/** Analog stick: up/down = gas/brake-reverse, left/right = steer. Plus a handbrake button. */
function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pad = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const move = (clientX: number, clientY: number) => {
    const rect = pad.current!.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const sx = dx / STICK_RADIUS;
    const sy = dy / STICK_RADIUS;
    input.touchSteer = Math.abs(sx) < DEADZONE ? 0 : -sx;
    input.touchThrottle = Math.abs(sy) < DEADZONE ? 0 : -sy;
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    input.touchSteer = 0;
    input.touchThrottle = 0;
  };
  useEffect(() => release, []);

  return (
    <div className="vx-touch">
      <div
        ref={pad}
        className="vx-stick"
        role="application"
        aria-label="Analog kemudi: geser ke atas untuk gas, ke bawah untuk rem atau mundur, kiri dan kanan untuk belok"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) move(e.clientX, e.clientY);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span className="vx-stick-arrow up">▲</span>
        <span className="vx-stick-arrow down">▼</span>
        <span className="vx-stick-arrow left">◀</span>
        <span className="vx-stick-arrow right">▶</span>
        <span className="vx-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <button
        className="vx-pedal brake"
        aria-label="Rem tangan"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          input.handbrake = true;
        }}
        onPointerUp={() => (input.handbrake = false)}
        onPointerCancel={() => (input.handbrake = false)}
      >
        Rem
      </button>
    </div>
  );
}

function Help() {
  const help = useGame((s) => s.help);
  return (
    <AnimatePresence>
      {help && (
        <motion.div key="help" className="vx-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => store.set({ help: false })}>
        <motion.div className="vx-help" role="dialog" aria-modal="true" aria-label="Bantuan kontrol" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
          <button className="vx-close" onClick={() => store.set({ help: false })} aria-label="Tutup bantuan">
            <X size={18} />
          </button>
          <h3>Cara bermain</h3>
          <ul>
            <li><kbd>W</kbd>/<kbd>↑</kbd> maju · <kbd>S</kbd>/<kbd>↓</kbd> rem & mundur</li>
            <li><kbd>A</kbd>/<kbd>←</kbd> <kbd>D</kbd>/<kbd>→</kbd> belok · <kbd>Spasi</kbd> rem tangan</li>
            <li><kbd>R</kbd> kembali ke jalan · <kbd>C</kbd> lihat seluruh peta · <kbd>M</kbd> suara</li>
            <li><kbd>Esc</kbd> tutup panel · klik pos di peta mini untuk langsung ke sana</li>
          </ul>
        </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AllVisitedToast() {
  const visited = useGame((s) => s.visited);
  const phase = useGame((s) => s.phase);
  const done = PROJECT_STATIONS.every((s) => visited.includes(s.id)) && !visited.includes('contact');
  return (
    <AnimatePresence>
      {done && phase === 'driving' && (
        <motion.div className="vx-toast" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, pointerEvents: 'none' }}>
          <Sparkles size={18} /> Semua proyek sudah dikunjungi! Mampir ke <b>Pos Kontak</b> untuk ngobrol dengan kami.
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const QUALITY_LABEL: Record<Quality, string> = { low: 'Ringan', medium: 'Sedang', high: 'Tinggi' };

export function Hud({ onLite }: { onLite: () => void }) {
  useKeyboard();
  const muted = useGame((s) => s.muted);
  const camera = useGame((s) => s.camera);
  const quality = useGame((s) => s.quality);
  const autoQuality = useGame((s) => s.autoQuality);
  const visited = useGame((s) => s.visited);
  const phase = useGame((s) => s.phase);
  const touch = useIsTouch();
  useEngineSound(muted || phase === 'loading');
  const count = PROJECT_STATIONS.filter((s) => visited.includes(s.id)).length;
  const cycleQuality = () => {
    const order: Quality[] = ['low', 'medium', 'high'];
    store.set({ quality: order[(order.indexOf(quality) + 1) % 3], autoQuality: false });
  };
  const playing = phase !== 'loading' && phase !== 'intro';

  return (
    <div className="vx-hud">
      {/* Text version of the page for screen readers and search engines. */}
      <section className="vx-sr-only">
        <h1>Vertinova — {COMPANY.tagline}</h1>
        <p>{COMPANY.intro}</p>
        <h2>Proyek</h2>
        {PROJECTS.map((p) => (
          <article key={p.id}>
            <h3>{p.fullName}</h3>
            <p>{p.description}</p>
            {p.url && <a href={p.url}>{p.url}</a>}
          </article>
        ))}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </section>

      <header className="vx-top">
        <div className="vx-brand">
          <img src={COMPANY.logo} alt="Vertinova" />
          <div>
            <strong>Vertinova</strong>
            <span>
              <MapPin size={12} /> Pos dikunjungi {count}/{PROJECT_STATIONS.length}
            </span>
          </div>
        </div>
        <div className="vx-tools">
          <button onClick={() => store.set({ muted: !muted })} aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'} title="Suara (M)">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={() => store.set({ camera: camera === 'chase' ? 'top' : 'chase' })} aria-label={camera === 'top' ? 'Kembali ke mobil' : 'Lihat seluruh peta'} title="Peta (C)">
            <Camera size={18} />
          </button>
          <button onClick={cycleQuality} aria-label={`Kualitas grafis: ${QUALITY_LABEL[quality]}`} title="Kualitas grafis" className="vx-text-btn vx-quality">
            {QUALITY_LABEL[quality]}
            {autoQuality ? ' · auto' : ''}
          </button>
          {playing && (
            <button onClick={() => (commands.reset = true)} aria-label="Kembalikan mobil ke jalan" title="Reset (R)">
              <RotateCcw size={18} />
            </button>
          )}
          <button onClick={() => store.set((s) => ({ help: !s.help }))} aria-label="Bantuan kontrol" title="Bantuan (H)">
            <HelpCircle size={18} />
          </button>
          <button onClick={onLite} className="vx-text-btn" aria-label="Lihat versi ringkas tanpa 3D">
            <LayoutList size={18} /> <span className="vx-hide-sm">Versi ringkas</span>
          </button>
          <a className="vx-text-btn vx-login" href="/admin">
            Masuk
          </a>
        </div>
      </header>

      {playing && (
        <>
          <NextTarget />
          <AllVisitedToast />
          {touch ? phase === 'driving' && <TouchControls /> : <Minimap />}
          <Speedometer />
        </>
      )}
      <StationPanel />
      <Intro onLite={onLite} />
      <Help />
      <LoadingScreen />
    </div>
  );
}
