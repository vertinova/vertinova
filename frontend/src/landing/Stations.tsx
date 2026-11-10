import { Billboard, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { COMPANY, projectById } from './projects';
import { facadeTexture, flagTexture, labelTexture } from './textures';
import { Instances, matrix, roofGeometry, windMaterial, type StaticShape, useStaticColliders } from './World';
import { ROAD_HALF, STATIONS, rng, routeFrame, stationLayout, type Station } from './layout';

type BoxProps = { position: [number, number, number]; size: [number, number, number]; color?: string; rotation?: [number, number, number]; children?: ReactNode; emissive?: string };

function Box({ position, size, color = '#ffffff', rotation, emissive, children }: BoxProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      {children ?? <meshStandardMaterial color={color} roughness={0.8} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.6 : 0} />}
    </mesh>
  );
}

/** Paved station ground with kerbs; thick enough to hide small terrain bumps underneath. */
function Pad({ w, d, color }: { w: number; d: number; color: string }) {
  const kerb = '#94a3b8';
  return (
    <>
      <Box position={[0, -0.18, 0]} size={[w, 0.6, d]} color={color} />
      <Box position={[0, 0.02, d / 2]} size={[w + 0.6, 0.36, 0.3]} color={kerb} />
      <Box position={[0, 0.02, -d / 2]} size={[w + 0.6, 0.36, 0.3]} color={kerb} />
      <Box position={[w / 2, 0.02, 0]} size={[0.3, 0.36, d]} color={kerb} />
      <Box position={[-w / 2, 0.02, 0]} size={[0.3, 0.36, d]} color={kerb} />
    </>
  );
}

/** Hip roof that fits a rectangular footprint (scale is applied outside the 45° turn, so it stays rectangular). */
function HipRoof({ position, width, depth, height, color }: { position: [number, number, number]; width: number; depth: number; height: number; color: string }) {
  return (
    <group position={[position[0], position[1] + height / 2, position[2]]} scale={[width / Math.SQRT2, height, depth / Math.SQRT2]}>
      <mesh rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Fixed box collider + mesh together, in the station's local frame. */
function Solid(props: BoxProps) {
  return (
    <>
      <Box {...props} />
      <CuboidCollider position={props.position} rotation={props.rotation} args={[props.size[0] / 2, props.size[1] / 2, props.size[2] / 2]} />
    </>
  );
}

function Label({ text, sub, position, width, height, bg, fg, accent, rotation }: { text: string; sub?: string; position: [number, number, number]; width: number; height: number; bg?: string; fg?: string; accent?: string; rotation?: [number, number, number] }) {
  const texture = useMemo(() => labelTexture(text, { sub, bg, fg, accent, width: 1024, height: Math.round((1024 * height) / width) }), [text, sub, bg, fg, accent, width, height]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.6} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.35} />
    </mesh>
  );
}

function ImageBoard({ url, position, width, rotation, frame = '#1f2937' }: { url: string; position: [number, number, number]; width: number; rotation?: [number, number, number]; frame?: string }) {
  const texture = useTexture(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  const image = texture.image as { width: number; height: number };
  const height = (width * image.height) / image.width;
  // The camera never rotates, so project boards turn (around Y only) to stay readable from above.
  return (
    <group position={position} rotation={rotation}>
      <FaceCamera>
        <Box position={[0, 0, -0.12]} size={[width + 0.5, height + 0.5, 0.2]} color={frame} />
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial map={texture} roughness={0.5} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.3} />
        </mesh>
      </FaceCamera>
    </group>
  );
}

/** Cancels the parent rotation so children face world +Z — toward the fixed camera. */
function FaceCamera({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const done = useRef(false);
  useFrame(() => {
    const g = ref.current;
    if (done.current || !g?.parent) return;
    g.parent.updateWorldMatrix(true, false);
    g.quaternion.copy(g.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    done.current = true;
  });
  return <group ref={ref}>{children}</group>;
}

function Flagpole({ position, height = 11 }: { position: [number, number, number]; height?: number }) {
  const material = useMemo(() => {
    const m = windMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }, 0.12, true);
    return m;
  }, []);
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, height, 8]} />
        <meshStandardMaterial color="#d9dde2" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[1.5, height - 1, 0]} material={material}>
        <planeGeometry args={[3, 2, 12, 1]} />
      </mesh>
      <CuboidCollider position={[0, height / 2, 0]} args={[0.15, height / 2, 0.15]} />
    </group>
  );
}

/** Tall glowing marker so each station can be spotted from far away. */
function Beacon({ station, y = 11 }: { station: Station; y?: number }) {
  // Sits in the forecourt (local +Z faces the road) so it never pokes through a roof.
  const at: [number, number, number] = station.kind === 'gate' ? [0, 0, 0] : [0, 0, 9];
  const ring = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => labelTexture(station.short, { bg: station.color, width: 256, height: 256 }), [station]);
  useFrame((state) => {
    if (!ring.current) return;
    ring.current.rotation.y = state.clock.elapsedTime * 0.8;
    ring.current.position.y = y + Math.sin(state.clock.elapsedTime * 1.6) * 0.6;
  });
  return (
    <group position={at}>
      <mesh position={[0, y / 2, 0]}>
        <cylinderGeometry args={[0.6, 1.4, y, 16, 1, true]} />
        <meshBasicMaterial color={station.color} transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} position={[0, y, 0]}>
        <torusGeometry args={[2.4, 0.22, 10, 40]} />
        <meshStandardMaterial color={station.color} emissive={station.color} emissiveIntensity={1.2} />
      </mesh>
      <Billboard position={[0, y, 0]}>
        <mesh>
          <circleGeometry args={[1.9, 40]} />
          <meshBasicMaterial map={texture} />
        </mesh>
      </Billboard>
    </group>
  );
}

function Person({ position, shirt = '#ffffff', pants = '#ffffff', rotation = 0 }: { position: [number, number, number]; shirt?: string; pants?: string; rotation?: number }) {
  return (
    <group position={position} rotation-y={rotation}>
      <Box position={[0, 0.45, 0]} size={[0.42, 0.9, 0.3]} color={pants} />
      <Box position={[0, 1.2, 0]} size={[0.5, 0.65, 0.32]} color={shirt} />
      <mesh position={[0, 1.72, 0]} castShadow>
        <sphereGeometry args={[0.2, 10, 8]} />
        <meshStandardMaterial color="#c68b59" />
      </mesh>
      <Box position={[0, 1.92, 0]} size={[0.34, 0.12, 0.34]} color="#111827" />
    </group>
  );
}

function SimpaskorStation({ station }: { station: Station }) {
  const project = projectById('simpaskor')!;
  return (
    <>
      <Pad w={34} d={24} color="#d6d0c2" />
      <Box position={[0, 0.14, 0]} size={[26, 0.02, 16]} color="#bdb6a6" />
      <Flagpole position={[0, 0, -7]} height={12} />
      {/* Paskibra formation */}
      {Array.from({ length: 3 }).flatMap((_, r) => Array.from({ length: 5 }, (_, c) => <Person key={`${r}-${c}`} position={[(c - 2) * 1.6, 0.13, 1 + r * 1.6]} />))}
      <Person position={[0, 0.13, -1.4]} shirt="#ffffff" pants="#1f2937" rotation={Math.PI} />
      {/* Tribune */}
      {[0, 1, 2, 3].map((t) => (
        <Solid key={t} position={[0, 0.5 + t * 0.6, -12 - t * 1.4]} size={[24, 1 + t * 1.2, 1.6]} color={t % 2 ? '#e5e7eb' : '#ef4444'} />
      ))}
      <Box position={[0, 6.4, -14]} size={[26, 0.25, 7]} color="#f8fafc" />
      {[-12, 0, 12].map((x) => (
        <Box key={x} position={[x, 3.2, -16.8]} size={[0.3, 6.4, 0.3]} color="#94a3b8" />
      ))}
      {/* Scoreboard */}
      <group position={[13.5, 0, -2]} rotation-y={-0.5}>
        <Solid position={[-3.5, 3, 0]} size={[0.4, 6, 0.4]} color="#334155" />
        <Solid position={[3.5, 3, 0]} size={[0.4, 6, 0.4]} color="#334155" />
        <ImageBoard url={project.billboard!} position={[0, 8.2, 0.3]} width={10.4} frame="#0f172a" />
        <Label text="SKOR LIVE" sub="Penilaian real-time" position={[0, 4.6, 0.3]} width={7} height={1.5} bg="#dc2626" />
      </group>
      <Label text="SIMPASKOR" sub="Sistem Paskibra Skor" position={[-13, 3.2, 8.5]} width={7} height={2.2} bg="#b91c1c" accent="#fde047" />
      <Solid position={[-13, 1, 8.3]} size={[0.3, 2, 0.3]} color="#475569" />
      <Beacon station={station} />
    </>
  );
}

function OfficeBuilding({ width, depth, floors, wall, roof, glass }: { width: number; depth: number; floors: number; wall: string; roof: string; glass: string }) {
  const height = floors * 3.6;
  const front = useMemo(() => facadeTexture({ wall, glass, cols: Math.round(width / 3), rows: floors }), [wall, glass, width, floors]);
  const side = useMemo(() => facadeTexture({ wall, glass, cols: Math.round(depth / 3), rows: floors }), [wall, glass, depth, floors]);
  const mats = useMemo(() => {
    const f = new THREE.MeshStandardMaterial({ map: front, roughness: 0.8 });
    const s = new THREE.MeshStandardMaterial({ map: side, roughness: 0.8 });
    return [s, s, new THREE.MeshStandardMaterial({ color: wall }), new THREE.MeshStandardMaterial({ color: wall }), f, f];
  }, [front, side, wall]);
  return (
    <>
      <mesh position={[0, height / 2, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <CuboidCollider position={[0, height / 2, 0]} args={[width / 2, height / 2, depth / 2]} />
      {/* Hip roof: a 4-sided cone scaled to the footprint */}
      <HipRoof position={[0, height, 0]} width={width + 2} depth={depth + 2} height={2.4} color={roof} />
    </>
  );
}

function ParkedCars({ positions }: { positions: [number, number, number, string][] }) {
  return (
    <>
      {positions.map(([x, z, r, color], i) => (
        <group key={i} position={[x, 0, z]} rotation-y={Number(r)}>
          <Solid position={[0, 0.7, 0]} size={[4, 0.8, 1.8]} color={color} />
          <Box position={[-0.2, 1.35, 0]} size={[2.2, 0.6, 1.6]} color="#cbd5e1" />
        </group>
      ))}
    </>
  );
}

function DpmdStation({ station }: { station: Station }) {
  const project = projectById('dpmd')!;
  return (
    <>
      <Pad w={40} d={30} color="#cfc8b8" />
      <group position={[0, 0, -7]}>
        <OfficeBuilding width={22} depth={10} floors={2} wall="#f5efe2" roof="#b5482f" glass="#5f8fa8" />
        <Box position={[0, 3.7, 5.6]} size={[7, 0.3, 3]} color="#f8fafc" />
        {[-3, 3].map((x) => (
          <Box key={x} position={[x, 1.8, 6.8]} size={[0.4, 3.6, 0.4]} color="#f8fafc" />
        ))}
        <Label text="DINAS PEMBERDAYAAN MASYARAKAT DAN DESA" position={[0, 4.6, 5.25]} width={14} height={1} bg="#14532d" />
      </group>
      {/* Gapura */}
      {[-5, 5].map((x) => (
        <Solid key={x} position={[x, 2.5, 13.5]} size={[1.4, 5, 1.4]} color="#e8dcc4" />
      ))}
      <Box position={[0, 5.4, 13.5]} size={[12, 1, 1.6]} color="#b5482f" />
      <Label text="DPMD KAB. BOGOR" position={[0, 5.4, 14.32]} width={9} height={0.9} bg="#7c2d12" />
      <ImageBoard url={project.billboard!} position={[13, 5, 7]} width={7.2} frame="#14532d" />
      <Solid position={[13, 1.3, 7]} size={[0.4, 2.6, 0.4]} color="#475569" />
      <Flagpole position={[-12, 0, 6]} />
      <ParkedCars positions={[[-14, -4, Math.PI / 2, '#f8fafc'], [-10.5, -4, Math.PI / 2, '#1e3a8a'], [14, -4, Math.PI / 2, '#b91c1c']]} />
      <Hedges width={36} z={12} />
      <Beacon station={station} y={12} />
    </>
  );
}

function Hedges({ width, z }: { width: number; z: number }) {
  // Two hedges with a gap in the middle for the entrance.
  return (
    <>
      {[-1, 1].map((s) => (
        <Box key={s} position={[s * (width / 4 + 3), 0.6, z]} size={[width / 2 - 8, 1.2, 1.2]} color="#2f7a34" />
      ))}
    </>
  );
}

function Playground() {
  return (
    <group>
      <Box position={[0, 0.06, 0]} size={[14, 0.12, 10]} color="#f97316" />
      <Box position={[-3.5, 0.07, 0]} size={[5, 0.12, 8]} color="#38bdf8" />
      {/* Slide */}
      <Solid position={[-4, 1.5, -2]} size={[2, 0.2, 2]} color="#facc15" />
      {[[-4.9, -2.9], [-3.1, -2.9], [-4.9, -1.1], [-3.1, -1.1]].map(([x, z]) => (
        <Box key={`${x}${z}`} position={[x, 0.75, z]} size={[0.15, 1.5, 0.15]} color="#64748b" />
      ))}
      <Box position={[-4, 0.8, 0.6]} size={[1.2, 0.12, 3.4]} rotation={[0.45, 0, 0]} color="#ef4444" />
      {/* Swings */}
      <Box position={[3, 2.6, -1]} size={[5, 0.15, 0.15]} color="#a855f7" />
      {[0.6, 5.4].map((x) =>
        [-0.6, 0.6].map((dz) => <Box key={`${x}${dz}`} position={[x, 1.3, -1 + dz]} rotation={[dz > 0 ? -0.4 : 0.4, 0, 0]} size={[0.15, 2.8, 0.15]} color="#a855f7" />),
      )}
      {[2, 4].map((x) => (
        <Box key={x} position={[x, 0.7, -1]} size={[0.8, 0.08, 0.4]} color="#22c55e" />
      ))}
      {/* Seesaw */}
      <Box position={[3, 0.5, 2.8]} size={[4, 0.12, 0.4]} rotation={[0, 0, 0.18]} color="#ec4899" />
      <Box position={[3, 0.25, 2.8]} size={[0.4, 0.5, 0.4]} color="#64748b" />
    </group>
  );
}

function Dp3Station({ station }: { station: Station }) {
  const project = projectById('dp3ap2kb')!;
  return (
    <>
      <Pad w={38} d={30} color="#d9d2e6" />
      <group position={[4, 0, -8]}>
        <OfficeBuilding width={18} depth={9} floors={2} wall="#fbe3ee" roof="#db2777" glass="#7aa7c7" />
        <Label text="DP3AP2KB" sub="Presensi Pegawai" position={[0, 4.8, 4.56]} width={8} height={1.8} bg="#9d174d" />
      </group>
      <group position={[-10, 0, 5]}>
        <Playground />
      </group>
      {[[-14, 3, '#fbbf24'], [-6, 4, '#38bdf8'], [-10, 1, '#f472b6']].map(([x, z, color], i) => (
        <Person key={i} position={[Number(x), 0.1, Number(z)]} shirt={String(color)} pants="#334155" rotation={i} />
      ))}
      <ImageBoard url={project.billboard!} position={[13, 5.2, 8]} width={6.4} frame="#9d174d" />
      <Solid position={[13, 1.3, 8]} size={[0.4, 2.6, 0.4]} color="#475569" />
      <Flagpole position={[14, 0, -2]} />
      <Hedges width={34} z={13} />
      <Beacon station={station} />
    </>
  );
}

function ForbasiStation({ station }: { station: Station }) {
  const project = projectById('forbasi')!;
  return (
    <>
      <Pad w={42} d={30} color="#d7dccf" />
      {/* Arena: running track around a parade field */}
      <Box position={[0, 0.14, -1]} size={[28, 0.04, 18]} color="#c2410c" />
      <Box position={[0, 0.17, -1]} size={[22, 0.04, 12]} color="#4ade80" />
      <Box position={[0, 0.2, -1]} size={[0.15, 0.02, 12]} color="#f8fafc" />
      <Box position={[0, 0.2, -1]} size={[22, 0.02, 0.15]} color="#f8fafc" />
      {/* Marching squad */}
      {Array.from({ length: 3 }).flatMap((_, r) =>
        Array.from({ length: 4 }, (_, c) => <Person key={`${r}-${c}`} position={[(c - 1.5) * 1.7 - 3, 0.2, -3 + r * 1.7]} shirt="#1e3a8a" pants="#111827" />),
      )}
      <Person position={[4, 0.2, -1]} shirt="#111827" pants="#111827" rotation={-Math.PI / 2} />
      {/* Grandstand with green roof */}
      {[0, 1, 2].map((t) => (
        <Solid key={t} position={[0, 0.5 + t * 0.6, -12 - t * 1.3]} size={[26, 1 + t * 1.2, 1.5]} color={t % 2 ? '#f8fafc' : '#16a34a'} />
      ))}
      <Box position={[0, 5.6, -13.6]} size={[28, 0.25, 6]} color="#14532d" />
      {[-13, 0, 13].map((x) => (
        <Box key={x} position={[x, 2.8, -16]} size={[0.3, 5.6, 0.3]} color="#94a3b8" />
      ))}
      <Label text="KEJURNAS FORBASI" sub="Forum Baris Indonesia" position={[0, 4.6, -11.2]} width={12} height={1.8} bg="#14532d" accent="#facc15" />
      <ImageBoard url={project.billboard!} position={[-15, 5.2, 9]} width={7.6} frame="#14532d" />
      <Solid position={[-15, 1.3, 9]} size={[0.4, 2.6, 0.4]} color="#475569" />
      <Flagpole position={[15, 0, 9]} />
      <Hedges width={38} z={13.5} />
      <Beacon station={station} />
    </>
  );
}

function AksaraStation({ station }: { station: Station }) {
  const project = projectById('aksara')!;
  const pediment = useMemo(roofGeometry, []);
  return (
    <>
      <Pad w={40} d={30} color="#e7e5e4" />
      <group position={[0, 0, -7]}>
        <OfficeBuilding width={22} depth={10} floors={2} wall="#f8fafc" roof="#1e3a8a" glass="#64748b" />
        {/* Dome */}
        <mesh position={[0, 9.6, 0]} castShadow>
          <sphereGeometry args={[2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#d4a017" metalness={0.5} roughness={0.35} />
        </mesh>
        <Box position={[0, 8.9, 0]} size={[5.6, 1.4, 5.6]} color="#f1f5f9" />
        {/* Portico: columns + pediment */}
        {[-4.5, -1.5, 1.5, 4.5].map((x) => (
          <Solid key={x} position={[x, 3.3, 6.6]} size={[0.6, 6.6, 0.6]} color="#f8fafc" />
        ))}
        <Box position={[0, 6.8, 6.4]} size={[11, 0.5, 2.4]} color="#e2e8f0" />
        <mesh geometry={pediment} position={[0, 7.75, 6.4]} scale={[11, 1.4, 2.4]} castShadow>
          <meshStandardMaterial color="#f1f5f9" flatShading />
        </mesh>
        <Box position={[0, 0.3, 7]} size={[12, 0.6, 3]} color="#cbd5e1" />
        <Label text="SEKRETARIAT DPRD" sub="Kabupaten Bogor" position={[0, 6.8, 7.62]} width={9} height={0.9} bg="#1e3a8a" />
      </group>
      {/* Route signpost: the travel ("perjalanan dinas") theme */}
      <group position={[13, 0, 9]}>
        <Solid position={[0, 1.6, 0]} size={[0.25, 3.2, 0.25]} color="#475569" />
        <Box position={[0.9, 2.8, 0]} size={[1.8, 0.45, 0.1]} color="#4f46e5" />
        <Box position={[-0.9, 2.2, 0]} size={[1.8, 0.45, 0.1]} color="#d4a017" />
        <Box position={[0.7, 1.6, 0]} size={[1.4, 0.45, 0.1]} color="#16a34a" />
      </group>
      <ImageBoard url={project.billboard!} position={[-14, 5, 9]} width={6.4} frame="#1e3a8a" />
      <Solid position={[-14, 1.3, 9]} size={[0.4, 2.6, 0.4]} color="#475569" />
      <Flagpole position={[-16, 0, -1]} />
      <ParkedCars positions={[[13, -2, Math.PI / 2, '#111827'], [16.5, -2, Math.PI / 2, '#111827']]} />
      <Hedges width={36} z={13} />
      <Beacon station={station} />
    </>
  );
}

function SireStation({ station }: { station: Station }) {
  const project = projectById('sire')!;
  const green = '#1f6f4a';
  const cream = '#efe4d0';
  return (
    <>
      <Pad w={38} d={28} color="#e7dcc7" />
      {/* Café building with striped awning */}
      <group position={[0, 0, -7]}>
        <Solid position={[0, 2.4, 0]} size={[16, 4.8, 9]} color={cream} />
        <Box position={[0, 5, 0]} size={[16.6, 0.4, 9.6]} color={green} />
        <Box position={[0, 1.6, 4.52]} size={[10, 2.6, 0.06]} color="#7fb3a1" />
        <Box position={[0, 1.2, 4.55]} size={[1.4, 2.4, 0.06]} color="#5b3a1e" />
        {Array.from({ length: 8 }, (_, i) => (
          <Box key={i} position={[-7 + i * 2, 3.5, 5.3]} size={[2, 0.12, 1.8]} rotation={[0.35, 0, 0]} color={i % 2 ? cream : green} />
        ))}
        <Label text="sire." sub="coffee" position={[0, 4.3, 4.56]} width={5} height={1.3} bg={green} fg={cream} />
        {/* Giant cup on the roof */}
        <group position={[5, 5.2, 0]}>
          <mesh position={[0, 1.4, 0]} castShadow>
            <cylinderGeometry args={[1.3, 1, 2.8, 16]} />
            <meshStandardMaterial color={cream} />
          </mesh>
          <mesh position={[0, 2.78, 0]}>
            <cylinderGeometry args={[1.2, 1.2, 0.05, 16]} />
            <meshStandardMaterial color="#5b3a1e" />
          </mesh>
          <mesh position={[1.35, 1.5, 0]} rotation-z={Math.PI / 2}>
            <torusGeometry args={[0.5, 0.14, 8, 16, Math.PI]} />
            <meshStandardMaterial color={cream} />
          </mesh>
        </group>
      </group>
      {/* Outdoor seating: tables with umbrellas */}
      {[[-10, 6], [-4, 8], [4, 8], [10, 6]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Solid position={[0, 0.5, 0]} size={[1.4, 1, 1.4]} color="#5b3a1e" />
          <Box position={[0, 1.6, 0]} size={[0.1, 2.2, 0.1]} color="#e2e8f0" />
          <mesh position={[0, 2.8, 0]} castShadow>
            <coneGeometry args={[1.8, 0.8, 8]} />
            <meshStandardMaterial color={i % 2 ? green : cream} flatShading />
          </mesh>
          {[-1, 1].map((s) => (
            <Box key={s} position={[s * 1.2, 0.35, 0]} size={[0.6, 0.7, 0.6]} color="#8b5a2b" />
          ))}
        </group>
      ))}
      <Person position={[-4, 0.1, 6.6]} shirt="#f97316" pants="#334155" />
      <Person position={[4, 0.1, 9.4]} shirt="#38bdf8" pants="#334155" rotation={Math.PI} />
      <ImageBoard url={project.billboard!} position={[-14, 5, 9]} width={6.6} frame={green} />
      <Solid position={[-14, 1.3, 9]} size={[0.4, 2.6, 0.4]} color="#475569" />
      <Hedges width={34} z={12.5} />
      <Beacon station={station} />
    </>
  );
}

function ContactStation({ station }: { station: Station }) {
  return (
    <>
      <Pad w={40} d={32} color="#e2e8f0" />
      <group position={[0, 0, -7]}>
        <OfficeBuilding width={16} depth={11} floors={5} wall="#0f3d3a" roof="#0f766e" glass="#7dd3fc" />
        <Label text="VERTINOVA" sub="Technology Partner" position={[0, 8, 5.56]} width={11} height={3} bg="#0b2b26" accent="#2dd4bf" />
      </group>
      <ImageBoard url={COMPANY.logo} position={[-12, 4.5, 6]} width={4.5} frame="#0b2b26" />
      <Solid position={[-12, 1.2, 5.8]} size={[0.4, 2.4, 0.4]} color="#475569" />
      {/* Fountain */}
      <mesh position={[8, 0.4, 7]} castShadow>
        <cylinderGeometry args={[3, 3.2, 0.8, 24]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[8, 0.82, 7]}>
        <cylinderGeometry args={[2.6, 2.6, 0.05, 24]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.3} />
      </mesh>
      <CuboidCollider position={[8, 0.4, 7]} args={[3, 0.4, 3]} />
      <Label text="KONTAK & KERJA SAMA" position={[0, 2.6, 13]} width={10} height={1.4} bg="#0369a1" />
      <Solid position={[0, 1, 12.8]} size={[10.4, 2, 0.3]} color="#0c4a6e" />
      <ParkedCars positions={[[14, -6, Math.PI / 2, '#14b8a6'], [-14, -6, Math.PI / 2, '#f8fafc']]} />
      <Beacon station={station} y={14} />
    </>
  );
}

function Gate({ station }: { station: Station }) {
  const offset = ROAD_HALF + 2;
  return (
    <>
      {[-1, 1].map((s) => (
        <Solid key={s} position={[0, 4.5, s * offset]} size={[1.6, 9, 1.6]} color="#0f3d3a" />
      ))}
      <Box position={[0, 9.4, 0]} size={[1.4, 1.8, offset * 2 + 3]} color="#0b2b26" />
      <Label text="VERTINOVA" sub="Selamat datang · kemudikan mobil untuk menjelajah" position={[-0.72, 9.4, 0]} rotation={[0, -Math.PI / 2, 0]} width={offset * 2 + 2.6} height={1.6} bg="#0b2b26" accent="#2dd4bf" />
      <Label text="VERTINOVA" sub="Terima kasih sudah berkunjung" position={[0.72, 9.4, 0]} rotation={[0, Math.PI / 2, 0]} width={offset * 2 + 2.6} height={1.6} bg="#0b2b26" accent="#2dd4bf" />
      <Beacon station={station} y={10} />
    </>
  );
}

function RoadSign({ station }: { station: Station }) {
  const f = routeFrame(station.index - 30);
  const p = f.position.clone().addScaledVector(f.normal, (ROAD_HALF + 2.4) * station.side);
  const texture = useMemo(() => labelTexture(station.label, { sub: 'Berhenti sebentar di depan →', bg: '#14532d', accent: station.color }), [station]);
  // Face drivers coming along the route.
  const rotY = 0; // fixed top-down camera looks toward -Z, so signs face +Z to stay readable
  const shapes = useMemo<StaticShape[]>(() => [{ type: 'cylinder', x: p.x, y: 1.5, z: p.z, r: 0.2, hh: 1.5 }], [p.x, p.z]);
  useStaticColliders(shapes);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={rotY}>
      <Box position={[0, 1.6, -0.05]} size={[0.15, 3.2, 0.15]} color="#64748b" />
      <mesh position={[0, 3.6, 0.04]}>
        <planeGeometry args={[5.2, 1.3]} />
        <meshStandardMaterial map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.3} />
      </mesh>
      <Box position={[0, 3.6, -0.02]} size={[5.4, 1.5, 0.08]} color="#e2e8f0" />
    </group>
  );
}

const STATION_VIEWS: Record<string, (props: { station: Station }) => ReactNode> = {
  gate: Gate,
  simpaskor: SimpaskorStation,
  dpmd: DpmdStation,
  dp3ap2kb: Dp3Station,
  forbasi: ForbasiStation,
  aksara: AksaraStation,
  sire: SireStation,
  contact: ContactStation,
};

export function Stations() {
  const pads = useMemo(() => STATIONS.map((s) => ({ s, layout: stationLayout(s) })), []);
  // Grass ring around each pad so it blends into the terrain.
  const flowers = useMemo(() => {
    const random = rng(31);
    return pads.flatMap(({ s, layout }) =>
      s.kind === 'gate'
        ? []
        : Array.from({ length: 40 }, () => {
            const a = random() * Math.PI * 2;
            const r = 19 + random() * 8;
            return { matrix: matrix(layout.center.x + Math.cos(a) * r, 0.25, layout.center.z + Math.sin(a) * r, 0, 0.35), color: ['#f43f5e', '#facc15', '#f8fafc', '#a855f7'][Math.floor(random() * 4)] };
          }),
    );
  }, [pads]);
  const ball = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ flatShading: true }), []);
  return (
    <>
      {pads.map(({ s, layout }) => {
        const View = STATION_VIEWS[s.id];
        const rotation = s.kind === 'gate' ? layout.heading : layout.facing;
        const y = s.kind === 'gate' ? layout.position.y : 0;
        return (
          <group key={s.id}>
            <RigidBody type="fixed" colliders={false} position={[layout.center.x, y, layout.center.z]} rotation={[0, rotation, 0]}>
              <View station={s} />
            </RigidBody>
            {s.kind !== 'gate' && <RoadSign station={s} />}
          </group>
        );
      })}
      <Instances geometry={ball} material={mat} items={flowers} shadows={false} />
    </>
  );
}
