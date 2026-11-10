import { ContactShadows, OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

// Wooden bowl heaped with spices. Everything is procedural geometry (no model or texture downloads).

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Item = { p: [number, number, number]; r?: [number, number, number]; s?: number | [number, number, number]; c?: string };

function Instanced({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Item[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(...it.p);
      o.rotation.set(...(it.r ?? [0, 0, 0]));
      const s = it.s ?? 1;
      if (Array.isArray(s)) o.scale.set(...s);
      else o.scale.setScalar(s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.c) m.setColorAt(i, c.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow />;
}

const BOWL_RIM = 1.62;
const heapHeight = (r: number) => 0.5 + 0.5 * Math.max(0, 1 - (r / 1.38) ** 2);

function Bowl() {
  const geometry = useMemo(() => {
    const pts = [
      [0, 0], [0.8, 0.02], [1.25, 0.18], [1.52, 0.5], [BOWL_RIM, 0.82], [1.55, 0.84], [1.44, 0.52], [1.18, 0.26], [0.75, 0.13], [0, 0.11],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#6b3d20" roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function StarAnise({ position, rotation, scale = 1 }: { position: [number, number, number]; rotation?: [number, number, number]; scale?: number }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: 8 }, (_, i) => (
        <group key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]}>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
            <coneGeometry args={[0.07, 0.3, 6]} />
            <meshStandardMaterial color="#6e3518" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0.14, 0.05, 0]} castShadow>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#c58a4a" roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#5a2b14" />
      </mesh>
    </group>
  );
}

function Heap() {
  const data = useMemo(() => {
    const random = rng(7);
    const corns: Item[] = [];
    for (let i = 0; i < 1100; i++) {
      const r = Math.sqrt(random()) * 1.38;
      const a = random() * Math.PI * 2;
      const white = random() < 0.28;
      corns.push({ p: [Math.cos(a) * r, heapHeight(r) + random() * 0.05, Math.sin(a) * r], s: 0.85 + random() * 0.35, c: white ? '#d8ccb4' : random() < 0.5 ? '#2b2622' : '#3a312a' });
    }
    // A few spilled on the table.
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2;
      const r = 1.8 + random() * 0.45;
      corns.push({ p: [Math.cos(a) * r, 0.055, Math.sin(a) * r], s: 0.9, c: random() < 0.3 ? '#d8ccb4' : '#2b2622' });
    }
    const sticks: Item[] = [
      { p: [-0.3, heapHeight(0.3) + 0.12, 0.2], r: [0.2, 0.5, Math.PI / 2 - 0.25] },
      { p: [0.25, heapHeight(0.25) + 0.16, -0.15], r: [-0.15, -0.7, Math.PI / 2 + 0.2] },
      { p: [0.05, heapHeight(0.1) + 0.2, 0.35], r: [0.1, 1.4, Math.PI / 2 - 0.1] },
      { p: [1.85, 0.08, 0.75], r: [0, 0.3, Math.PI / 2] },
      { p: [1.7, 0.08, 1.0], r: [0, 0.45, Math.PI / 2] },
    ];
    const cloves: Item[] = Array.from({ length: 14 }, () => {
      const r = random() * 1.1;
      const a = random() * Math.PI * 2;
      return { p: [Math.cos(a) * r, heapHeight(r) + 0.08, Math.sin(a) * r], r: [random() * 3, random() * 3, random() * 3] };
    });
    const nuts: Item[] = [
      { p: [-0.75, heapHeight(0.8) + 0.08, -0.45], r: [0.3, 0.2, 0.5], s: [0.17, 0.21, 0.17] },
      { p: [-1.75, 0.18, -0.95], r: [0.2, 0.4, 1.4], s: [0.17, 0.21, 0.17] },
      { p: [-1.95, 0.18, -0.55], r: [1.2, 0.2, 0.3], s: [0.16, 0.2, 0.16] },
    ];
    return { corns, sticks, cloves, nuts };
  }, []);

  const geo = useMemo(
    () => ({
      corn: new THREE.IcosahedronGeometry(0.055, 1),
      stick: new THREE.CylinderGeometry(0.075, 0.075, 1.15, 10),
      clove: (() => {
        const stem = new THREE.CylinderGeometry(0.018, 0.012, 0.22, 6);
        stem.translate(0, -0.11, 0);
        const head = new THREE.SphereGeometry(0.045, 8, 6);
        const positions = [stem, head].flatMap((g) => Array.from(g.toNonIndexed().attributes.position.array));
        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        merged.computeVertexNormals();
        return merged;
      })(),
      nut: new THREE.SphereGeometry(1, 16, 12),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      corn: new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }),
      stick: new THREE.MeshStandardMaterial({ color: '#8a4b2a', roughness: 0.75 }),
      clove: new THREE.MeshStandardMaterial({ color: '#5a2f1c', roughness: 0.7, flatShading: true }),
      nut: new THREE.MeshStandardMaterial({ color: '#9a6a3f', roughness: 0.6 }),
    }),
    [],
  );

  return (
    <>
      {/* Filler dome so no gaps show between peppercorns */}
      <mesh position={[0, 0.45, 0]} scale={[1.42, 0.55, 1.42]}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#231d18" roughness={0.9} />
      </mesh>
      <Instanced geometry={geo.corn} material={mat.corn} items={data.corns} />
      <Instanced geometry={geo.stick} material={mat.stick} items={data.sticks} />
      <Instanced geometry={geo.clove} material={mat.clove} items={data.cloves} />
      <Instanced geometry={geo.nut} material={mat.nut} items={data.nuts} />
      <StarAnise position={[0.55, heapHeight(0.6) + 0.1, 0.45]} rotation={[0.25, 0.4, 0.1]} />
      <StarAnise position={[-0.4, heapHeight(0.5) + 0.12, 0.65]} rotation={[-0.2, 1.1, 0.15]} scale={0.9} />
      <StarAnise position={[1.35, 0.06, -1.45]} rotation={[0, 0.6, 0]} />
    </>
  );
}

function Scene({ autoRotate }: { autoRotate: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!group.current) return;
    if (autoRotate) group.current.rotation.y += dt * 0.18;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
  });
  return (
    <group ref={group}>
      <Bowl />
      <Heap />
    </group>
  );
}

export default function Hero3D() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  // Touch devices: no orbit controls (they would block page scrolling); the scene rotates on its own.
  const [touch] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // Radial mask: soft edge instead of a hard cut where sparkles or the spill reach the canvas border.
    <div ref={wrap} className={`h-full w-full [mask-image:radial-gradient(closest-side,#000_82%,transparent)] ${touch ? '' : 'cursor-grab active:cursor-grabbing'}`}>
      <Canvas frameloop={visible ? 'always' : 'never'} dpr={[1, 2]} shadows camera={{ position: [0, 3.6, 6.5], fov: 36 }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0.5, 0)}>
        <ambientLight intensity={0.55} color="#ffe6c4" />
        <directionalLight position={[3.5, 6, 3]} intensity={2.4} color="#ffd8a3" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <pointLight position={[-3, 2.2, -2]} intensity={10} color="#ff8a3d" />
        <pointLight position={[2.5, 1.2, 3]} intensity={4} color="#ffd29a" />
        <Scene autoRotate={touch} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={9} blur={2.4} far={3} color="#2a160a" />
        <Sparkles count={30} scale={[4, 2.4, 4]} position={[0, 1.6, 0]} size={2.4} speed={0.25} color="#f5c27a" opacity={0.7} />
        {!touch && <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.7} minPolarAngle={0.55} maxPolarAngle={1.2} target={[0, 0.5, 0]} />}
      </Canvas>
    </div>
  );
}
