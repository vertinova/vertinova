import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SpiceArt } from './SpiceArt';

// Remotion composition: the five process steps as a looping motion piece.

const FPS = 30;
const STEP = 66; // frames per step
const WIDE = { w: 1280, h: 720 };
const PORTRAIT = { w: 720, h: 900 };
const usePortrait = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};
const CREAM = '#f6ead7';
const SAFFRON = '#e0a526';

type Props = { steps: readonly (readonly [string, string])[]; world: string };

function StepTitle({ index, title, text }: { index: number; title: string; text: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const exit = interpolate(frame, [STEP - 10, STEP], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', ...(usePortrait() ? { left: 64, top: 70, width: 592 } : { left: 96, top: 120, width: 470 }), opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 40 - exit * 20}px)` }}>
      <div style={{ font: '700 26px "Plus Jakarta Sans", sans-serif', color: SAFFRON, letterSpacing: 2 }}>
        {String(index + 1).padStart(2, '0')} / 05
      </div>
      <div style={{ font: '800 100px "Bricolage Grotesque", sans-serif', color: CREAM, lineHeight: 1, marginTop: 14, letterSpacing: -4 }}>{title}</div>
      <div style={{ font: '500 30px "Plus Jakarta Sans", sans-serif', color: 'rgba(246,234,215,0.75)', lineHeight: 1.35, marginTop: 22 }}>{text}</div>
    </div>
  );
}

/** Right-hand illustration, one per step. */
function Scene({ index, world }: { index: number; world: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = (delay = 0) => spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 140 } });
  const fade = interpolate(frame, [0, 8, STEP - 10, STEP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const placement = usePortrait() ? { left: 80, top: 330 } : { right: 90, top: 90 };
  const box: React.CSSProperties = { position: 'absolute', ...placement, width: 560, height: 470, opacity: fade };

  if (index === 0) {
    // Harvest: three stems grow, buds pop open.
    return (
      <div style={box}>
        {[0, 1, 2].map((i) => {
          const grow = interpolate(frame, [i * 6, 30 + i * 6], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
          return (
            <div key={i} style={{ position: 'absolute', bottom: 40, left: 110 + i * 150, width: 10, height: 300 * grow + 20 * i, background: '#4f6b3a', borderRadius: 6, transformOrigin: 'bottom' }}>
              {[0, 1, 2].map((b) => (
                <div key={b} style={{ position: 'absolute', left: b % 2 ? 12 : -50, top: 30 + b * 80, width: 48, height: 48, transform: `scale(${pop(24 + i * 6 + b * 4)})` }}>
                  <SpiceArt kind="clove" />
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ position: 'absolute', bottom: 0, left: 40, right: 40, height: 40, background: '#3a2414', borderRadius: 20 }} />
      </div>
    );
  }
  if (index === 1) {
    // Sort: peppercorns fall and split into two piles by colour.
    return (
      <div style={box}>
        {Array.from({ length: 18 }, (_, i) => {
          const white = i % 3 === 0;
          const t = interpolate(frame, [i * 2, i * 2 + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
          const x = 260 + Math.sin(i * 1.7) * 30 + (white ? 140 : -140) * t;
          const y = 20 + t * 330 - Math.floor(i / 3) * 14 * t;
          return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 34, height: 34, borderRadius: 999, background: white ? '#d8ccb4' : '#2b2622', boxShadow: 'inset -5px -6px 0 rgba(0,0,0,0.2)' }} />;
        })}
        {['#2b2622', '#d8ccb4'].map((c, i) => (
          <div key={c} style={{ position: 'absolute', bottom: 0, left: i ? 330 : 50, width: 180, height: 50, borderRadius: '0 0 90px 90px', border: `6px solid ${c}`, borderTop: 'none' }} />
        ))}
      </div>
    );
  }
  if (index === 2) {
    // Dry: sun turns, cinnamon sticks shimmer in the heat.
    const spin = frame * 1.6;
    return (
      <div style={box}>
        <div style={{ position: 'absolute', right: 30, top: 0, width: 170, height: 170, transform: `rotate(${spin}deg) scale(${pop()})` }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: 80, top: -6, width: 10, height: 40, borderRadius: 6, background: SAFFRON, transformOrigin: '5px 91px', transform: `rotate(${i * 30}deg)` }} />
          ))}
          <div style={{ position: 'absolute', inset: 40, borderRadius: 999, background: SAFFRON }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', left: 30 + i * 140, top: 220 + Math.sin((frame + i * 10) / 6) * 6, width: 170, height: 170, transform: `rotate(${-8 + i * 8}deg)` }}>
            <SpiceArt kind="stick" />
          </div>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ position: 'absolute', left: 60 + i * 120, top: 160 - ((frame * 2 + i * 25) % 80), width: 40, height: 4, borderRadius: 4, background: 'rgba(246,234,215,0.35)', opacity: 1 - ((frame * 2 + i * 25) % 80) / 80 }} />
        ))}
      </div>
    );
  }
  if (index === 3) {
    // Pack: a sack rises, the batch label stamps on.
    const rise = pop();
    const stamp = spring({ frame: frame - 22, fps, config: { damping: 10, stiffness: 200 } });
    return (
      <div style={box}>
        <div style={{ position: 'absolute', left: 140, top: 60 + (1 - rise) * 120, width: 300, height: 360, borderRadius: '40px 40px 28px 28px', background: '#c9a26b', boxShadow: 'inset -24px -20px 0 rgba(0,0,0,0.12)' }}>
          <div style={{ position: 'absolute', left: 110, top: -26, width: 80, height: 50, borderRadius: 20, background: '#a37f4c' }} />
          <div style={{ position: 'absolute', left: 36, right: 36, top: 130, padding: '18px 16px', borderRadius: 14, background: CREAM, transform: `scale(${2 - stamp})`, opacity: Math.min(1, stamp * 1.5), font: '800 26px "Plus Jakarta Sans", sans-serif', color: '#2a1a10', textAlign: 'center', lineHeight: 1.3 }}>
            BATCH 24-11
            <div style={{ font: '600 18px "Plus Jakarta Sans", sans-serif', color: '#9c4a24' }}>KERINCI · 25 KG</div>
          </div>
        </div>
      </div>
    );
  }
  // Ship: container ship sails across the waves.
  const sail = interpolate(frame, [0, STEP], [-80, 300]);
  return (
    <div style={box}>
      <svg width="560" height="470" viewBox="0 0 560 470" style={{ position: 'absolute', inset: 0 }}>
        <path d="M30 200 C140 60 380 60 520 170" stroke={SAFFRON} strokeWidth="4" strokeDasharray="10 12" strokeDashoffset={-frame * 2} fill="none" opacity="0.7" />
        <circle cx="30" cy="200" r="10" fill={SAFFRON} />
        <circle cx="520" cy="170" r="10" fill={CREAM} />
      </svg>
      <div style={{ position: 'absolute', left: 10, top: 222, font: '700 22px "Plus Jakarta Sans", sans-serif', color: SAFFRON }}>Indonesia</div>
      <div style={{ position: 'absolute', right: 0, top: 192, font: '700 22px "Plus Jakarta Sans", sans-serif', color: CREAM }}>{world}</div>
      <div style={{ position: 'absolute', left: sail, top: 300, width: 220, height: 90 }}>
        {['#9c4a24', SAFFRON, '#4f6b3a', CREAM].map((c, i) => (
          <div key={c} style={{ position: 'absolute', left: 40 + i * 36, top: 8, width: 32, height: 26, background: c, borderRadius: 3 }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 36, height: 40, background: '#e8dcc8', clipPath: 'polygon(0 0, 100% 0, 88% 100%, 8% 100%)' }} />
      </div>
      {[0, 1].map((i) => (
        <div key={i} style={{ position: 'absolute', left: -40 + ((frame * (3 + i) + i * 140) % 640) - 40, top: 392 + i * 22, width: 160, height: 6, borderRadius: 6, background: 'rgba(246,234,215,0.25)' }} />
      ))}
    </div>
  );
}

function Track({ steps }: Pick<Props, 'steps'>) {
  const frame = useCurrentFrame();
  const active = Math.min(4, Math.floor(frame / STEP));
  const progress = (frame % STEP) / STEP;
  return (
    <div style={{ position: 'absolute', ...(usePortrait() ? { left: 48, right: 48, bottom: 44 } : { left: 96, right: 96, bottom: 70 }), display: 'flex', gap: 14 }}>
      {steps.map(([title], i) => (
        <div key={title} style={{ flex: 1 }}>
          <div style={{ height: 6, borderRadius: 6, background: 'rgba(246,234,215,0.18)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${i < active ? 100 : i === active ? progress * 100 : 0}%`, background: SAFFRON }} />
          </div>
          <div style={{ marginTop: 14, font: '700 22px "Plus Jakarta Sans", sans-serif', color: i <= active ? CREAM : 'rgba(246,234,215,0.45)' }}>{title}</div>
        </div>
      ))}
    </div>
  );
}

function ProcessComposition({ steps, world }: Props) {
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 70% 30%, #4a2a16, #1f140d 70%)' }}>
      {steps.map(([title, text], i) => (
        <Sequence key={title} from={i * STEP} durationInFrames={STEP} layout="none">
          <StepTitle index={i} title={title} text={text} />
          <Scene index={i} world={world} />
        </Sequence>
      ))}
      <Track steps={steps} />
    </AbsoluteFill>
  );
}

/** Responsive player that only plays while on screen. */
export default function ProcessVideo({ steps, world }: Props) {
  const [portrait, setPortrait] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setPortrait(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const size = portrait ? PORTRAIT : WIDE;
  const player = useRef<PlayerRef>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? player.current?.play() : player.current?.pause()), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="overflow-hidden rounded-[22px] border border-[#3a2414] shadow-[0_30px_60px_-30px_rgba(31,20,13,0.7)]">
      <Player
        ref={player}
        component={ProcessComposition}
        inputProps={{ steps, world }}
        durationInFrames={STEP * steps.length}
        fps={FPS}
        compositionWidth={size.w}
        compositionHeight={size.h}
        loop
        autoPlay
        controls={false}
        clickToPlay={false}
        style={{ width: '100%', aspectRatio: `${size.w} / ${size.h}` }}
      />
    </div>
  );
}
