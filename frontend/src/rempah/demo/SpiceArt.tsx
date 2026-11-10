import type { ArtKind } from './data';

/** Flat illustrations of each spice (no stock photos). viewBox 0 0 120 120. */
export function SpiceArt({ kind, className = '' }: { kind: ArtKind; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      {ART[kind]}
    </svg>
  );
}

const peppercorns = (fill: string, shade: string) =>
  [
    [38, 52, 11], [60, 44, 12], [82, 54, 11], [48, 72, 12], [72, 72, 12], [58, 92, 11], [30, 76, 9], [90, 78, 10], [62, 64, 9],
  ].map(([x, y, r], i) => (
    <g key={i}>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.28} fill={shade} opacity={0.55} />
    </g>
  ));

const ART: Record<ArtKind, React.ReactNode> = {
  stick: (
    <g>
      {[
        [26, -14],
        [44, -6],
        [62, 4],
      ].map(([x, rot], i) => (
        <g key={i} transform={`rotate(${rot} 60 60) translate(${x - 26} 0)`}>
          <rect x="24" y="14" width="22" height="92" rx="10" fill={i === 1 ? '#7a3f22' : '#8a4b2a'} />
          <path d="M28 18 Q35 26 42 18" stroke="#5c2c16" strokeWidth="3" fill="none" />
          <path d="M29 24 v76" stroke="#a8653d" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          <path d="M40 30 v66" stroke="#5c2c16" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      ))}
    </g>
  ),
  pepper: <g>{peppercorns('#2b2622', '#6b6158')}</g>,
  whitepepper: <g>{peppercorns('#d8ccb4', '#fffaf0')}</g>,
  clove: (
    <g>
      {[
        [40, 30, -20],
        [70, 36, 15],
        [52, 58, -5],
        [80, 66, 30],
        [34, 72, -35],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <path d="M-2.5 6 L-1.5 40 L1.5 40 L2.5 6 Z" fill="#5a2f1c" />
          <circle cx="0" cy="2" r="7" fill="#6e3a22" />
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="0" cy="-6" rx="3.4" ry="5.5" fill="#7a4430" transform={`rotate(${a + 45})`} />
          ))}
          <circle cx="0" cy="1" r="3.2" fill="#a8653d" />
        </g>
      ))}
    </g>
  ),
  nut: (
    <g>
      {[
        [44, 52, 22, 27, -15],
        [76, 70, 20, 25, 20],
      ].map(([x, y, rx, ry, rot], i) => (
        <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#9a6a3f" />
          {[-10, -3, 4, 11].map((dx) => (
            <path key={dx} d={`M${x + dx} ${y - ry + 6} Q${x + dx + 5} ${y} ${x + dx} ${y + ry - 6}`} stroke="#6f4826" strokeWidth="2" fill="none" opacity="0.7" />
          ))}
          <ellipse cx={x - rx * 0.35} cy={y - ry * 0.4} rx={rx * 0.25} ry={ry * 0.18} fill="#c99a6a" opacity="0.6" />
        </g>
      ))}
    </g>
  ),
  mace: (
    <g>
      <path d="M60 18 C40 30 30 52 36 74 C42 94 52 104 60 104 C68 104 78 94 84 74 C90 52 80 30 60 18 Z" fill="#c2410c" />
      {[
        'M48 30 C42 50 44 72 52 96',
        'M60 22 C56 46 58 74 60 100',
        'M72 30 C78 50 76 72 68 96',
      ].map((d) => (
        <path key={d} d={d} stroke="#7c2d12" strokeWidth="3" fill="none" opacity="0.55" />
      ))}
      <path d="M42 56 C50 52 54 60 60 56 C66 52 70 60 78 56" stroke="#fdba74" strokeWidth="2.5" fill="none" opacity="0.6" />
    </g>
  ),
  turmeric: (
    <g>
      <path d="M22 70 C20 56 36 50 48 54 C56 40 72 36 82 46 C96 42 104 56 96 66 C102 78 90 90 78 84 C70 96 52 96 46 86 C32 92 20 84 22 70 Z" fill="#b45309" />
      <path d="M30 70 C40 64 54 66 64 70 M58 56 C66 52 76 54 84 60 M50 80 C60 76 70 78 80 76" stroke="#7c3a0a" strokeWidth="2.5" fill="none" opacity="0.6" />
      <circle cx="94" cy="30" r="15" fill="#f59e0b" />
      <circle cx="94" cy="30" r="10" fill="#fbbf24" />
      <circle cx="94" cy="30" r="4" fill="#d97706" opacity="0.6" />
    </g>
  ),
  ginger: (
    <g>
      <path d="M18 74 C18 60 32 56 42 60 C46 44 62 40 70 50 C76 36 96 38 98 54 C110 60 106 78 92 80 C88 94 70 96 62 86 C50 96 30 92 28 82 C20 82 18 78 18 74 Z" fill="#c9a26b" />
      <path d="M30 72 C42 68 52 70 62 74 M66 58 C74 54 84 56 92 62 M50 84 C58 80 70 82 80 80" stroke="#8a6a3c" strokeWidth="2.5" fill="none" opacity="0.65" />
      <path d="M42 60 L40 50 M70 50 L72 42 M88 46 L92 38" stroke="#a37f4c" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  cardamom: (
    <g>
      {[
        [44, 56, -25],
        [72, 62, 20],
      ].map(([x, y, rot], i) => (
        <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx="14" ry="26" fill="#9ca36a" />
          <path d={`M${x} ${y - 24} V${y + 24}`} stroke="#6b7240" strokeWidth="2" />
        </g>
      ))}
    </g>
  ),
};
