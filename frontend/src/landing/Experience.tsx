import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Car } from './Car';
import { Hud } from './Hud';
import { Stations } from './Stations';
import { car, store, useGame, type Quality } from './store';
import { World } from './World';
import { STATIONS, stationLayout, terrainHeight } from './layout';

const QUALITY: Record<Quality, { dpr: [number, number]; shadowMap: number }> = {
  low: { dpr: [0.75, 1], shadowMap: 0 },
  medium: { dpr: [1, 1.25], shadowMap: 1024 },
  high: { dpr: [1, 2], shadowMap: 2048 },
};
const ORDER: Quality[] = ['low', 'medium', 'high'];

function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const quality = useGame((s) => s.quality);
  const size = QUALITY[quality].shadowMap;
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    return () => {
      scene.remove(l.target);
    };
  }, [scene]);
  useEffect(() => {
    const l = light.current;
    if (!l || !size) return;
    l.shadow.mapSize.set(size, size);
    l.shadow.map?.dispose();
    l.shadow.map = null;
  }, [size]);
  // Shadow camera follows the car, so shadows stay sharp over a large world.
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    l.position.set(car.position.x + 60, car.position.y + 90, car.position.z + 35);
    l.target.position.copy(car.position);
  });
  return (
    <>
      <hemisphereLight args={['#dbeafe', '#4d6b3a', 0.9]} />
      <directionalLight
        ref={light}
        intensity={2.6}
        color="#fff1d6"
        castShadow={size > 0}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-near={10}
        shadow-camera-far={260}
      />
    </>
  );
}

/** Fixed-angle camera above the car, always looking toward -Z (matches the north-up minimap). */
const FOLLOW = new THREE.Vector3(0, 40, 29);
const OVERVIEW = new THREE.Vector3(0, 205, 150);

function CameraRig() {
  const look = useRef(new THREE.Vector3());
  const desired = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const layouts = useMemo(() => Object.fromEntries(STATIONS.map((s) => [s.id, stationLayout(s)])), []);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const { phase, activeStation, camera } = store.get();
    let rate = 3.5;

    if ((phase === 'station' || phase === 'arriving') && activeStation && layouts[activeStation]) {
      const l = layouts[activeStation];
      const focus = activeStation === 'gate' ? l.position : l.center;
      target.copy(focus).setY(1);
      // Modal is centred over the scene; pull back a little so the whole station frames around it.
      desired.copy(target).addScaledVector(FOLLOW, 1.35);
      rate = phase === 'arriving' ? 1.8 : 2.4;
    } else if (phase === 'intro' || phase === 'loading' || camera === 'top') {
      const t = state.clock.elapsedTime * 0.15;
      target.set(0, 0, -6);
      desired.copy(OVERVIEW).add(new THREE.Vector3(Math.sin(t) * 18, 0, 0));
      if (camera === 'top' && phase !== 'intro' && phase !== 'loading') desired.copy(OVERVIEW);
      rate = 1.6;
    } else {
      // Look slightly ahead of the car and pull back a little at speed.
      const speed = Math.abs(car.speed);
      target.copy(car.position).addScaledVector(car.forward, Math.sign(car.speed) * Math.min(speed * 0.25, 5)).setY(car.position.y);
      desired.copy(target).addScaledVector(FOLLOW, 1 + Math.min(speed / 24, 1) * 0.25);
    }

    const k = 1 - Math.exp(-dt * rate);
    cam.position.lerp(desired, k);
    const ground = terrainHeight(cam.position.x, cam.position.z) + 3;
    if (cam.position.y < ground) cam.position.y = ground;
    look.current.lerp(target, Math.min(1, k * 1.3));
    cam.lookAt(look.current);
  });
  return null;
}

function Ready() {
  useEffect(() => {
    if (store.get().phase === 'loading') store.set({ phase: 'intro' });
  }, []);
  return null;
}

export default function Experience({ onLite }: { onLite: () => void }) {
  const quality = useGame((s) => s.quality);
  const autoQuality = useGame((s) => s.autoQuality);
  const step = (dir: 1 | -1) => {
    const s = store.get();
    if (!s.autoQuality) return;
    const next = ORDER[Math.max(0, Math.min(2, ORDER.indexOf(s.quality) + dir))];
    if (next !== s.quality) store.set({ quality: next });
  };

  return (
    <div className="vx-root">
      <Canvas
        className="vx-canvas"
        shadows={QUALITY[quality].shadowMap > 0 ? 'soft' : false}
        dpr={QUALITY[quality].dpr}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: true }}
        camera={{ fov: 32, near: 1, far: 700, position: [0, 175, 125] }}
      >
        <Sun />
        {autoQuality && <PerformanceMonitor onDecline={() => step(-1)} onIncline={() => step(1)} flipflops={3} />}
        <Suspense fallback={null}>
          <Physics timeStep={1 / 60} gravity={[0, -9.81, 0]}>
            <World />
            <Stations />
            <Car />
          </Physics>
          <Ready />
        </Suspense>
        <CameraRig />
      </Canvas>
      <Hud onLite={onLite} />
    </div>
  );
}
