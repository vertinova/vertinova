import * as THREE from 'three';

// World layout shared by the 3D scene, minimap and HUD. Units are metres, +Y up.

// Miniature diorama: a small floating island.
export const WORLD_SIZE = 230;
export const ROAD_HALF = 4.4;
export const WATER_LEVEL = -1.1;
const BRIDGE_HEIGHT = 1.9;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const ROUTE_SCALE = 0.45;
const ROUTE_POINTS: [number, number][] = (
  [
    [0, 155], [70, 140], [125, 100], [150, 30], [135, -40], [150, -100], [95, -150], [20, -130],
    [-45, -155], [-110, -120], [-150, -55], [-125, 10], [-150, 75], [-95, 135], [-40, 150],
  ] as [number, number][]
).map(([x, z]) => [x * ROUTE_SCALE, z * ROUTE_SCALE]);

export const route = new THREE.CatmullRomCurve3(
  ROUTE_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
);

export const ROUTE_COUNT = 400;
const routePts = route.getSpacedPoints(ROUTE_COUNT).slice(0, ROUTE_COUNT);
export const routeX = new Float32Array(routePts.map((p) => p.x));
export const routeZ = new Float32Array(routePts.map((p) => p.z));
export const routeLength = route.getLength();

export function nearestRoute(x: number, z: number) {
  let best = Infinity;
  let index = 0;
  for (let i = 0; i < ROUTE_COUNT; i++) {
    const dx = routeX[i] - x;
    const dz = routeZ[i] - z;
    const d = dx * dx + dz * dz;
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { d: Math.sqrt(best), i: index };
}

export const riverZ = (x: number) => 4 + 0.3 * x + 8 * Math.sin(x / 17);
const RIVER_X = Array.from({ length: WORLD_SIZE / 2 + 1 }, (_, i) => -WORLD_SIZE / 2 + i * 2);
export const riverPoints = RIVER_X.map((x) => new THREE.Vector3(x, 0, riverZ(x)));

export function riverDistance(x: number, z: number) {
  let best = Infinity;
  for (const p of riverPoints) {
    const dx = p.x - x;
    const dz = p.z - z;
    best = Math.min(best, dx * dx + dz * dz);
  }
  return Math.sqrt(best);
}

const routeRiverDist = Array.from({ length: ROUTE_COUNT }, (_, i) => riverDistance(routeX[i], routeZ[i]));
/** Road surface height per route sample: humps up into a bridge where it crosses the river. */
export const routeY = new Float32Array(routeRiverDist.map((d) => BRIDGE_HEIGHT * (1 - smoothstep(6, 18, d))));
export const isBridgeSample = (i: number) => routeRiverDist[i] < 9;

export function routeFrame(index: number) {
  const i = ((index % ROUTE_COUNT) + ROUTE_COUNT) % ROUTE_COUNT;
  const next = (i + 1) % ROUTE_COUNT;
  const prev = (i - 1 + ROUTE_COUNT) % ROUTE_COUNT;
  const tangent = new THREE.Vector3(routeX[next] - routeX[prev], 0, routeZ[next] - routeZ[prev]).normalize();
  const position = new THREE.Vector3(routeX[i], routeY[i], routeZ[i]);
  // Outward normal: perpendicular to tangent, pointing away from the loop centre.
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
  if (normal.x * position.x + normal.z * position.z < 0) normal.negate();
  const heading = Math.atan2(-tangent.z, tangent.x);
  return { position, tangent, normal, heading, index: i };
}

export type StationKind = 'gate' | 'project' | 'contact';
export type Station = {
  id: string;
  kind: StationKind;
  index: number;
  side: 1 | -1;
  label: string;
  short: string;
  color: string;
  offset: number;
};

const station = (id: string, kind: StationKind, u: number, side: 1 | -1, label: string, short: string, color: string, offset = 23): Station => ({
  id,
  kind,
  index: Math.round(u * ROUTE_COUNT) % ROUTE_COUNT,
  side,
  label,
  short,
  color,
  offset,
});

export const STATIONS: Station[] = [
  station('gate', 'gate', 0, 1, 'Gerbang Vertinova', 'S', '#14b8a6'),
  station('simpaskor', 'project', 0.09, 1, 'Pos 1 · Simpaskor', '1', '#ef4444', 24),
  station('dpmd', 'project', 0.315, 1, 'Pos 2 · DPMD Kab. Bogor', '2', '#f59e0b', 24),
  station('forbasi', 'project', 0.405, 1, 'Pos 3 · FORBASI', '3', '#16a34a', 24),
  station('dp3ap2kb', 'project', 0.5, -1, 'Pos 4 · DP3AP2KB Presensi', '4', '#ec4899', 26),
  station('aksara', 'project', 0.595, 1, 'Pos 5 · AKSARA Setwan DPRD', '5', '#4f46e5', 24),
  station('sire', 'project', 0.82, 1, 'Pos 6 · Sire Coffee', '6', '#1f6f4a', 24),
  station('contact', 'contact', 0.895, 1, 'Pos Kontak · Vertinova HQ', '★', '#0ea5e9', 24),
];

export function stationLayout(s: Station) {
  const frame = routeFrame(s.index);
  const normal = frame.normal.clone().multiplyScalar(s.side);
  const center = frame.position.clone().setY(0).addScaledVector(normal, s.kind === 'gate' ? 0 : s.offset);
  // Building faces the road.
  const facing = Math.atan2(-normal.x, -normal.z);
  return { ...frame, normal, center, facing };
}

const stationCenters = STATIONS.map((s) => ({ c: stationLayout(s).center, r: s.kind === 'gate' ? 12 : 30 }));

export function terrainHeight(x: number, z: number) {
  const { d: dRoad, i } = nearestRoute(x, z);
  // flat = 0 on station pads, 1 in the open.
  let flat = 1;
  for (const { c, r } of stationCenters) flat = Math.min(flat, smoothstep(r, r + 12, Math.hypot(c.x - x, c.z - z)));
  const dRiver = riverDistance(x, z);

  // Gentle hills only away from the road, stations and river; flat island rim.
  const n = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) * 0.5 + 0.5;
  const m = Math.sin(x * 0.11 + z * 0.09) * 0.5 + 0.5;
  const hills = n * 6 + m * 1.6;
  const edge = Math.max(Math.abs(x), Math.abs(z));

  const rim = 1 - smoothstep(WORLD_SIZE / 2 - 22, WORLD_SIZE / 2 - 6, edge);
  // Offroad: rolling bumps everywhere, including the dirt track.
  const bumps = Math.sin(x * 0.17) * Math.cos(z * 0.14) * 0.55 + Math.sin(x * 0.33 + z * 0.29) * 0.3;
  let h = (bumps + hills * smoothstep(8, 22, dRoad)) * flat * smoothstep(5, 14, dRiver) * rim;
  h -= 2.7 * (1 - smoothstep(3.5, 10, dRiver));

  // Embankment so bridge ramps sit on solid ground instead of floating.
  if (dRoad < ROAD_HALF + 5 && dRiver > 6.5 && routeY[i] > 0.01) {
    h = Math.max(h, routeY[i] - 0.08 - Math.max(0, dRoad - ROAD_HALF) * 0.35);
  }

  return h;
}

/** Mud puddles on the track: slow the car down and splash. */
export const PUDDLES = [100, 160, 225, 312, 375].map((i, k) => {
  const f = routeFrame(i);
  const off = (k % 2 ? 1 : -1) * 1.1;
  const x = f.position.x + f.normal.x * off;
  const z = f.position.z + f.normal.z * off;
  return { x, z, r: 3.4 + (k % 3) * 0.5 };
});
