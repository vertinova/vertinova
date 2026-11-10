import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { car, commands, dismissed, input, openStation, store } from './store';
import { labelTexture } from './textures';
import { CHASSIS_HALF, CHASSIS_MASS, WHEELS, WHEEL_RADIUS, WHEEL_WIDTH, applyDrive, setupWheels } from './vehicle';
import { PUDDLES, ROAD_HALF, STATIONS, nearestRoute, routeFrame, terrainHeight } from './layout';

const STATION_POINTS = STATIONS.map((s) => ({ id: s.id, p: routeFrame(s.index).position }));
const TRIGGER_RADIUS = 7;
const REARM_RADIUS = 16;

const UP = new THREE.Vector3(0, 1, 0);

function placeOnRoute(body: RapierRigidBody, index: number, lift = 2.2) {
  const f = routeFrame(index);
  const ground = Math.max(f.position.y, terrainHeight(f.position.x, f.position.z));
  body.setTranslation({ x: f.position.x, y: ground + lift, z: f.position.z }, true);
  const q = new THREE.Quaternion().setFromAxisAngle(UP, f.heading);
  body.setRotation(q, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function Dust({ emit }: { emit: React.MutableRefObject<{ points: THREE.Vector3[]; rate: number }> }) {
  const COUNT = 90;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => Array.from({ length: COUNT }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 })), []);
  const next = useRef(0);
  const acc = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    acc.current += emit.current.rate * dt;
    while (acc.current >= 1) {
      acc.current -= 1;
      for (const point of emit.current.points) {
        const part = particles[next.current];
        next.current = (next.current + 1) % COUNT;
        part.p.copy(point);
        part.v.set((Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 1.2);
        part.life = 1;
      }
    }
    particles.forEach((part, i) => {
      if (part.life > 0) {
        part.life -= dt * 0.9;
        part.p.addScaledVector(part.v, dt);
      }
      const s = part.life > 0 ? (1.4 - part.life) * 1.1 * part.life : 0;
      dummy.position.copy(part.p);
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#b8976b" transparent opacity={0.55} depthWrite={false} flatShading />
    </instancedMesh>
  );
}

type BoxPart = { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number]; m?: number; e?: string };

/** Offroad 4x4 built from boxes, in chassis-local space (+X forward). */
function CarBody({ tail }: { tail: THREE.MeshStandardMaterial }) {
  const decal = useMemo(() => labelTexture('VERTINOVA', { sub: 'OFFROAD 4x4', bg: '#0f766e', accent: '#facc15', width: 512, height: 160 }), []);
  const paint = '#14b8a6';
  const dark = '#1f2937';
  const trim = '#111827';
  const parts: BoxPart[] = [
    // Body tub and hood
    { p: [0, 0.02, 0], s: [5.0, 0.78, 2.36], c: paint, m: 0.3 },
    { p: [1.6, 0.47, 0], s: [1.8, 0.14, 2.3], c: paint, m: 0.3 },
    { p: [1.62, 0.56, 0], s: [1.2, 0.06, 0.5], c: dark },
    // Cabin, glass band, windshield
    { p: [-0.55, 0.88, 0], s: [2.7, 0.95, 2.24], c: '#f1f5f9' },
    { p: [-0.55, 0.96, 0], s: [2.74, 0.5, 2.28], c: '#1e293b', m: 0.6 },
    { p: [0.82, 0.96, 0], s: [0.06, 0.62, 2.1], c: '#334155', r: [0, 0, 0.32], m: 0.7 },
    // Roof rack + light bar
    { p: [-0.55, 1.42, -0.95], s: [2.5, 0.08, 0.08], c: trim },
    { p: [-0.55, 1.42, 0.95], s: [2.5, 0.08, 0.08], c: trim },
    { p: [-1.5, 1.42, 0], s: [0.08, 0.08, 1.98], c: trim },
    { p: [-0.6, 1.42, 0], s: [0.08, 0.08, 1.98], c: trim },
    { p: [0.55, 1.46, 0], s: [0.2, 0.2, 1.7], c: trim },
    { p: [0.66, 1.46, 0], s: [0.04, 0.12, 1.5], c: '#fffbe6', e: '#fff3c4' },
    // Fender flares over each wheel
    ...([1.72, -1.68] as const).flatMap((x) =>
      ([-1, 1] as const).map((z): BoxPart => ({ p: [x, 0.3, z * 1.24], s: [1.7, 0.16, 0.42], c: trim })),
    ),
    // Side steps
    { p: [0, -0.42, -1.26], s: [2.2, 0.08, 0.32], c: trim },
    { p: [0, -0.42, 1.26], s: [2.2, 0.08, 0.32], c: trim },
    // Bull bar
    { p: [2.62, -0.05, 0], s: [0.12, 0.12, 2.1], c: dark },
    { p: [2.62, 0.35, 0], s: [0.12, 0.12, 1.6], c: dark },
    { p: [2.62, 0.15, -0.75], s: [0.12, 0.5, 0.12], c: dark },
    { p: [2.62, 0.15, 0.75], s: [0.12, 0.5, 0.12], c: dark },
    // Grille, headlights, rear bumper
    { p: [2.52, 0.12, 0], s: [0.04, 0.4, 1.1], c: '#0f172a' },
    { p: [2.53, 0.16, -0.82], s: [0.06, 0.26, 0.36], c: '#fffbe6', e: '#fff3c4' },
    { p: [2.53, 0.16, 0.82], s: [0.06, 0.26, 0.36], c: '#fffbe6', e: '#fff3c4' },
    { p: [-2.54, -0.22, 0], s: [0.14, 0.26, 2.3], c: dark },
    // Snorkel
    { p: [1.05, 0.65, 1.22], s: [0.14, 1.2, 0.14], c: trim },
    { p: [1.05, 1.28, 1.12], s: [0.3, 0.14, 0.14], c: trim },
  ];
  return (
    <group>
      {parts.map((b, i) => (
        <mesh key={i} position={b.p} rotation={b.r} castShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={b.c} metalness={b.m ?? 0.1} roughness={0.45} emissive={b.e ?? '#000000'} emissiveIntensity={b.e ? 2 : 0} />
        </mesh>
      ))}
      {[-0.82, 0.82].map((z) => (
        <mesh key={z} position={[-2.53, 0.22, z]} material={tail}>
          <boxGeometry args={[0.06, 0.24, 0.32]} />
        </mesh>
      ))}
      {/* Spare wheel on the tailgate */}
      <group position={[-2.72, 0.42, 0]} rotation-z={Math.PI / 2}>
        <mesh castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.32, 10]} />
          <meshStandardMaterial color="#161616" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.04, 6]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* Door decals */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.2, 0.05, s * 1.185]} rotation-y={s < 0 ? Math.PI : 0}>
          <planeGeometry args={[1.9, 0.6]} />
          <meshStandardMaterial map={decal} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function Wheel() {
  return (
    <group rotation-x={Math.PI / 2}>
      <mesh castShadow>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 12]} />
        <meshStandardMaterial color="#161616" roughness={0.95} flatShading />
      </mesh>
      {/* Chunky tread blocks */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * WHEEL_RADIUS, 0, Math.sin(a) * WHEEL_RADIUS]} rotation-y={-a}>
            <boxGeometry args={[0.1, WHEEL_WIDTH * 0.9, 0.2]} />
            <meshStandardMaterial color="#262626" roughness={1} />
          </mesh>
        );
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * (WHEEL_WIDTH / 2 + 0.01), 0]}>
          <cylinderGeometry args={[WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, 0.03, 6]} />
          <meshStandardMaterial color="#facc15" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export function Car() {
  const body = useRef<RapierRigidBody>(null);
  const vehicle = useRef<DynamicRayCastVehicleController | null>(null);
  const steer = useRef(0);
  const steerGroups = useRef<(THREE.Group | null)[]>([]);
  const spinGroups = useRef<(THREE.Group | null)[]>([]);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#ef4444', emissiveIntensity: 0.6 }), []);
  const dust = useRef({ points: [new THREE.Vector3(), new THREE.Vector3()], rate: 0 });
  const { world, rapier } = useRapier();
  const start = routeFrame(STATIONS[0].index);

  useEffect(() => {
    if (!body.current) return;
    const v = world.createVehicleController(body.current);
    setupWheels(v);
    vehicle.current = v;
    return () => {
      world.removeVehicleController(v);
      vehicle.current = null;
    };
  }, [world]);

  useBeforePhysicsStep((w) => {
    const v = vehicle.current;
    if (!v) return;
    const { phase } = store.get();
    const driving = phase === 'driving';
    const throttle = driving ? clamp((input.up ? 1 : 0) - (input.down ? 1 : 0) + input.touchThrottle) : 0;
    const steering = driving ? clamp((input.left ? 1 : 0) - (input.right ? 1 : 0) + input.touchSteer) : 0;
    car.throttle = throttle;
    steer.current = applyDrive(v, { throttle, steer: steering, handbrake: driving && input.handbrake, autoBrake: !driving }, steer.current, w.timestep);
    v.updateVehicle(w.timestep, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
  });

  useFrame(() => {
    const b = body.current;
    const v = vehicle.current;
    if (!b || !v) return;

    if (commands.reset) {
      commands.reset = false;
      const t = b.translation();
      placeOnRoute(b, nearestRoute(t.x, t.z).i);
    }
    if (commands.teleport) {
      const station = STATIONS.find((s) => s.id === commands.teleport);
      commands.teleport = null;
      if (station) {
        placeOnRoute(b, station.index, 1.8);
        openStation(station.id);
      }
    }

    const t = b.translation();
    if (t.y < -25) placeOnRoute(b, nearestRoute(t.x, t.z).i);

    const r = b.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    car.position.set(t.x, t.y, t.z);
    car.forward.set(1, 0, 0).applyQuaternion(q).setY(0).normalize();
    car.speed = v.currentVehicleSpeed();

    // Station triggers by distance to the station's road point; re-armed once the car has driven away.
    for (const { id, p } of STATION_POINTS) {
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (d > REARM_RADIUS) dismissed.delete(id);
      else if (d < TRIGGER_RADIUS && !dismissed.has(id) && store.get().phase === 'driving') store.set({ phase: 'arriving', activeStation: id });
    }
    const { phase, activeStation } = store.get();
    if (phase === 'arriving' && Math.abs(car.speed) < 0.8 && activeStation) openStation(activeStation);

    WHEELS.forEach((wheel, i) => {
      const sg = steerGroups.current[i];
      const spin = spinGroups.current[i];
      if (!sg || !spin) return;
      sg.position.set(wheel.x, wheel.y - (v.wheelSuspensionLength(i) ?? 0.25), wheel.z);
      sg.rotation.y = v.wheelSteering(i) ?? 0;
      spin.rotation.z = -(v.wheelRotation(i) ?? 0);
    });

    const braking = (car.throttle < 0 && car.speed > 0.5) || (car.throttle > 0 && car.speed < -0.5) || input.handbrake || phase === 'arriving';
    tail.emissiveIntensity = braking ? 3.2 : 0.6;

    // Dust from the rear wheels when sliding sideways, hard braking, or driving off the road.
    const lin = b.linvel();
    const right = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const lateral = Math.abs(lin.x * right.x + lin.z * right.z);
    const offRoad = nearestRoute(t.x, t.z).d > ROAD_HALF + 1.5;
    const speed = Math.abs(car.speed);
    const anyContact = [2, 3].some((i) => v.wheelIsInContact(i));
    // Mud puddles: heavy drag and a big splash.
    const inMud = PUDDLES.some((m) => Math.hypot(m.x - t.x, m.z - t.z) < m.r);
    b.setLinearDamping(inMud ? 1.1 : 0.12);
    dust.current.rate = anyContact
      ? (lateral > 2.2 ? 30 : 0) + (offRoad && speed > 3 ? speed * 1.5 : 0) + (braking && speed > 8 ? 18 : 0) + (inMud && speed > 1.5 ? 45 : 0) + (speed > 6 ? speed * 0.8 : 0)
      : 0;
    [2, 3].forEach((i, k) => {
      const w = WHEELS[i];
      dust.current.points[k].set(w.x, w.y - 0.95, w.z).applyQuaternion(q).add(car.position);
    });
  });

  return (
    <>
      <RigidBody
        ref={body}
        colliders={false}
        position={[start.position.x, Math.max(start.position.y, terrainHeight(start.position.x, start.position.z)) + 2.2, start.position.z]}
        rotation={[0, start.heading, 0]}
        canSleep={false}
        linearDamping={0.12}
        angularDamping={0.8}
        ccd
      >
        <CuboidCollider args={[...CHASSIS_HALF]} mass={CHASSIS_MASS} friction={0.4} />
        <CarBody tail={tail} />
        {WHEELS.map((wheel, i) => (
          <group key={i} ref={(g) => { steerGroups.current[i] = g; }} position={[wheel.x, wheel.y - 0.25, wheel.z]}>
            <group ref={(g) => { spinGroups.current[i] = g; }}>
              <Wheel />
            </group>
          </group>
        ))}
      </RigidBody>
      <Dust emit={dust} />
    </>
  );
}
