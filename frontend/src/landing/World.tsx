import { useFrame } from '@react-three/fiber';
import { RigidBody, useRapier } from '@react-three/rapier';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from './store';
import { dirtTrackTexture, plankTexture, stripeTexture, waterTexture } from './textures';
import {
  PUDDLES,
  ROAD_HALF,
  ROUTE_COUNT,
  STATIONS,
  WATER_LEVEL,
  WORLD_SIZE,
  isBridgeSample,
  nearestRoute,
  riverDistance,
  riverPoints,
  rng,
  routeFrame,
  routeX,
  routeY,
  routeZ,
  stationLayout,
  terrainHeight,
} from './layout';

export const windTime = { value: 0 };

/** Standard material whose vertices sway with the shared wind clock (grass, leaves, flags). */
export function windMaterial(params: THREE.MeshStandardMaterialParameters, amplitude: number, flag = false) {
  const material = new THREE.MeshStandardMaterial(params);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      ${
        flag
          ? `transformed.z += sin(position.x * 2.4 - uTime * 6.0) * ${amplitude.toFixed(3)} * (position.x + 1.5);`
          : `float sway = sin(uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23) * ${amplitude.toFixed(3)};
             transformed.x += sway * max(position.y, 0.0);
             transformed.z += sway * 0.6 * max(position.y, 0.0);`
      }`,
    );
  };
  return material;
}

const tmp = new THREE.Object3D();
export function matrix(x: number, y: number, z: number, rotY = 0, sx = 1, sy = sx, sz = sx) {
  tmp.position.set(x, y, z);
  tmp.rotation.set(0, rotY, 0);
  tmp.scale.set(sx, sy, sz);
  tmp.updateMatrix();
  return tmp.matrix.clone();
}

type Item = { matrix: THREE.Matrix4; color?: THREE.Color | string };

export function Instances({
  geometry,
  material,
  items,
  shadows = true,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Item[];
  shadows?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new THREE.Color();
    items.forEach((item, i) => {
      mesh.setMatrixAt(i, item.matrix);
      if (item.color) mesh.setColorAt(i, color.set(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow />;
}

export type StaticShape =
  | { type: 'cuboid'; x: number; y: number; z: number; rotY?: number; hx: number; hy: number; hz: number }
  | { type: 'cylinder'; x: number; y: number; z: number; r: number; hh: number };

/** Adds fixed colliders straight into the physics world — far cheaper than one React element per tree. */
export function useStaticColliders(shapes: StaticShape[]) {
  const { world, rapier } = useRapier();
  useEffect(() => {
    const colliders = shapes.map((s) => {
      const desc = s.type === 'cuboid' ? rapier.ColliderDesc.cuboid(s.hx, s.hy, s.hz) : rapier.ColliderDesc.cylinder(s.hh, s.r);
      desc.setTranslation(s.x, s.y, s.z);
      if (s.type === 'cuboid' && s.rotY) desc.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotY));
      return world.createCollider(desc);
    });
    return () => colliders.forEach((c) => world.removeCollider(c, false));
  }, [shapes, world, rapier]);
}

const stationCenters = STATIONS.map((s) => stationLayout(s).center);
const nearStation = (x: number, z: number, r: number) => stationCenters.some((c) => Math.hypot(c.x - x, c.z - z) < r);
const half = WORLD_SIZE / 2 - 5;

function Terrain() {
  const geometry = useMemo(() => {
    const seg = 92;
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color('#6aa84f');
    const grassB = new THREE.Color('#4f8f3a');
    const forest = new THREE.Color('#356b2c');
    const rock = new THREE.Color('#6f7a5a');
    const sand = new THREE.Color('#a8956a');
    const mud = new THREE.Color('#6b5a3e');
    const random = rng(3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.5 + 0.5;
      c.copy(grassA).lerp(grassB, n * 0.8 + random() * 0.2);
      if (h > 6) c.lerp(forest, Math.min(1, (h - 6) / 8));
      if (h > 22) c.lerp(rock, Math.min(1, (h - 22) / 14));
      if (h < -0.3) c.copy(h < WATER_LEVEL ? mud : sand);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const skirt = useMemo(() => {
    // Soil sides of the floating island, sampled at the same spacing as the terrain grid.
    const seg = 92;
    const H = WORLD_SIZE / 2;
    const positions: number[] = [];
    const colors: number[] = [];
    const top = new THREE.Color('#8a6a45');
    const bottom = new THREE.Color('#4a3524');
    const edges: [number, number, number, number][] = [[-H, -H, 1, 0], [H, -H, 0, 1], [H, H, -1, 0], [-H, H, 0, -1]];
    for (const [x0, z0, dx, dz] of edges) {
      for (let k = 0; k < seg; k++) {
        const step = WORLD_SIZE / seg;
        const ax = x0 + dx * k * step, az = z0 + dz * k * step;
        const bx = ax + dx * step, bz = az + dz * step;
        const ha = terrainHeight(ax, az), hb = terrainHeight(bx, bz);
        positions.push(ax, ha, az, bx, hb, bz, ax, -10, az, bx, hb, bz, bx, -10, bz, ax, -10, az);
        for (const c of [top, top, bottom, top, bottom, bottom]) colors.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  // Invisible walls along the island rim keep the car on the diorama.
  const walls = useMemo<StaticShape[]>(() => {
    const H = WORLD_SIZE / 2 + 0.5;
    return [
      { type: 'cuboid', x: H, y: 2, z: 0, hx: 0.5, hy: 5, hz: H },
      { type: 'cuboid', x: -H, y: 2, z: 0, hx: 0.5, hy: 5, hz: H },
      { type: 'cuboid', x: 0, y: 2, z: H, hx: H, hy: 5, hz: 0.5 },
      { type: 'cuboid', x: 0, y: 2, z: -H, hx: H, hy: 5, hz: 0.5 },
    ];
  }, []);
  useStaticColliders(walls);

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={1.2}>
        <mesh geometry={geometry} receiveShadow>
          <meshStandardMaterial vertexColors flatShading roughness={1} />
        </mesh>
      </RigidBody>
      <mesh geometry={skirt}>
        <meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** Ribbon that follows the route and hugs the bumpy terrain (or the bridge deck). */
function ribbon(halfWidth: number, yOffset: number, vScale: number) {
  const CROSS = 5; // vertices across, so the surface follows bumps across the track too
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let dist = 0;
  for (let k = 0; k <= ROUTE_COUNT; k++) {
    const i = k % ROUTE_COUNT;
    const { position, tangent } = routeFrame(i);
    if (k > 0) {
      const p = (k - 1) % ROUTE_COUNT;
      dist += Math.hypot(routeX[i] - routeX[p], routeZ[i] - routeZ[p]);
    }
    const left = new THREE.Vector3(tangent.z, 0, -tangent.x);
    for (let c = 0; c < CROSS; c++) {
      const t = c / (CROSS - 1);
      const x = position.x + left.x * halfWidth * (t * 2 - 1);
      const z = position.z + left.z * halfWidth * (t * 2 - 1);
      positions.push(x, (isBridgeSample(i) ? routeY[i] : terrainHeight(x, z)) + yOffset, z);
      uvs.push(t, dist / vScale);
    }
    if (k < ROUTE_COUNT) {
      for (let c = 0; c < CROSS - 1; c++) {
        const a = k * CROSS + c;
        indices.push(a, a + CROSS, a + 1, a + 1, a + CROSS, a + CROSS + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Winding depends on route direction; make sure the surface faces up.
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    g.setIndex(indices);
    g.computeVertexNormals();
  }
  return g;
}

function Road() {
  const { road, shoulder, texture } = useMemo(
    () => ({ road: ribbon(ROAD_HALF, 0.12, 14), shoulder: ribbon(ROAD_HALF + 1.6, 0.07, 14), texture: dirtTrackTexture() }),
    [],
  );
  return (
    <>
      <RigidBody type="fixed" colliders="trimesh" friction={1.5}>
        <mesh geometry={road} receiveShadow>
          <meshStandardMaterial map={texture} roughness={1} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </RigidBody>
      <mesh geometry={shoulder} receiveShadow>
        <meshStandardMaterial color="#7f8a4a" roughness={1} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <Bridges />
      <TrailMarkers />
      <Puddles />
      <Logs />
    </>
  );
}

function Bridges() {
  const data = useMemo(() => {
    const deck: Item[] = [];
    const posts: Item[] = [];
    const rails: Item[] = [];
    const pillars: Item[] = [];
    const shapes: StaticShape[] = [];
    for (let i = 0; i < ROUTE_COUNT; i++) {
      if (!isBridgeSample(i)) continue;
      const a = routeFrame(i);
      const b = routeFrame(i + 1);
      const mid = a.position.clone().lerp(b.position, 0.5);
      const len = a.position.distanceTo(b.position) + 0.05;
      const pitch = Math.atan2(b.position.y - a.position.y, len);
      const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.heading, pitch, 'YXZ'));
      // Plank deck sits a hair above the dirt ribbon so the wood is what you see.
      deck.push({ matrix: new THREE.Matrix4().compose(new THREE.Vector3(mid.x, mid.y - 0.16, mid.z), rot, new THREE.Vector3(len, 0.6, ROAD_HALF * 2 + 1.2)) });
      for (const side of [-1, 1]) {
        const p = mid.clone().addScaledVector(a.normal, (ROAD_HALF + 0.35) * side);
        rails.push({ matrix: new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y + 1, p.z), rot, new THREE.Vector3(len, 0.18, 0.22)) });
        if (i % 2 === 0) posts.push({ matrix: matrix(p.x, p.y + 0.5, p.z, a.heading, 0.26, 1.1, 0.26) });
        shapes.push({ type: 'cuboid', x: p.x, y: p.y + 0.6, z: p.z, rotY: a.heading, hx: len / 2, hy: 0.6, hz: 0.12 });
      }
      if (riverDistance(mid.x, mid.z) < 1.2 && i % 3 === 0) {
        for (const side of [-1, 1]) {
          const p = mid.clone().addScaledVector(a.normal, (ROAD_HALF - 1) * side);
          pillars.push({ matrix: matrix(p.x, (mid.y - 0.6 - 3) / 2, p.z, 0, 0.7, mid.y - 0.6 + 3, 0.7) });
        }
      }
    }
    return { deck, posts, rails, pillars, shapes };
  }, []);
  useStaticColliders(data.shapes);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const cyl = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 1, 8), []);
  const planks = useMemo(() => new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.95 }), []);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b3a1e', roughness: 0.95, flatShading: true }), []);
  const rail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a4b24', roughness: 0.9 }), []);
  return (
    <>
      <Instances geometry={box} material={planks} items={data.deck} />
      <Instances geometry={box} material={wood} items={data.posts} />
      <Instances geometry={box} material={rail} items={data.rails} />
      <Instances geometry={cyl} material={wood} items={data.pillars} />
    </>
  );
}

/** Orange-white trail poles along the track instead of street lamps. */
function TrailMarkers() {
  const data = useMemo(() => {
    const poles: Item[] = [];
    const tops: Item[] = [];
    const shapes: StaticShape[] = [];
    for (let i = 6; i < ROUTE_COUNT; i += 14) {
      if (isBridgeSample(i) || STATIONS.some((s) => Math.abs(s.index - i) < 12 || Math.abs(s.index + ROUTE_COUNT - i) < 12)) continue;
      const f = routeFrame(i);
      const side = Math.floor(i / 14) % 2 ? 1 : -1;
      const p = f.position.clone().addScaledVector(f.normal, (ROAD_HALF + 2) * side);
      const h = terrainHeight(p.x, p.z);
      poles.push({ matrix: matrix(p.x, h + 0.9, p.z, 0, 0.12, 1.8, 0.12) });
      tops.push({ matrix: matrix(p.x, h + 1.75, p.z, 0, 0.16, 0.22, 0.16) });
      shapes.push({ type: 'cylinder', x: p.x, y: h + 0.9, z: p.z, r: 0.14, hh: 0.9 });
    }
    return { poles, tops, shapes };
  }, []);
  useStaticColliders(data.shapes);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 6), []);
  const striped = useMemo(() => new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.7 }), []);
  const reflector = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 0.8 }), []);
  return (
    <>
      <Instances geometry={cyl} material={striped} items={data.poles} />
      <Instances geometry={cyl} material={reflector} items={data.tops} shadows={false} />
    </>
  );
}

function Puddles() {
  const items = useMemo(() => PUDDLES.map((p) => ({ matrix: matrix(p.x, terrainHeight(p.x, p.z) + 0.16, p.z, 0, p.r, 0.04, p.r * 0.75) })), []);
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 18), []);
  const mud = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3726', roughness: 0.12, metalness: 0.2 }), []);
  return <Instances geometry={geo} material={mud} items={items} shadows={false} />;
}

/** Fallen logs and boulders beside the track: obstacles to steer around. */
function Logs() {
  const data = useMemo(() => {
    const random = rng(77);
    const logs: Item[] = [];
    const boulders: Item[] = [];
    const shapes: StaticShape[] = [];
    for (let i = 20; i < ROUTE_COUNT; i += 37) {
      if (isBridgeSample(i) || STATIONS.some((s) => Math.abs(s.index - i) < 16 || Math.abs(s.index + ROUTE_COUNT - i) < 16)) continue;
      const f = routeFrame(i);
      const side = random() < 0.5 ? -1 : 1;
      const p = f.position.clone().addScaledVector(f.normal, (ROAD_HALF + 3.2) * side);
      const h = terrainHeight(p.x, p.z);
      const len = 3 + random() * 2;
      const yaw = f.heading + (random() - 0.5) * 0.5;
      logs.push({
        matrix: new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, h + 0.35, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2, 'YXZ')),
          new THREE.Vector3(0.38, len, 0.38),
        ),
      });
      shapes.push({ type: 'cuboid', x: p.x, y: h + 0.35, z: p.z, rotY: yaw, hx: len / 2, hy: 0.35, hz: 0.38 });
      const q = f.position.clone().addScaledVector(f.normal, (ROAD_HALF + 3.5) * -side).addScaledVector(f.tangent, 4);
      const s = 0.9 + random() * 0.8;
      const qh = terrainHeight(q.x, q.z);
      boulders.push({ matrix: matrix(q.x, qh + s * 0.4, q.z, random() * 6, s * 1.3, s, s * 1.1), color: random() < 0.5 ? '#8a8d86' : '#9a8f7c' });
      shapes.push({ type: 'cylinder', x: q.x, y: qh + s * 0.4, z: q.z, r: s * 1.05, hh: s * 0.5 });
    }
    return { logs, boulders, shapes };
  }, []);
  useStaticColliders(data.shapes);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8), []);
  const rock = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const bark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4a2f', roughness: 1, flatShading: true }), []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), []);
  return (
    <>
      <Instances geometry={cyl} material={bark} items={data.logs} />
      <Instances geometry={rock} material={stone} items={data.boulders} />
    </>
  );
}

function River() {
  const { geometry, texture } = useMemo(() => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    riverPoints.forEach((p, k) => {
      const next = riverPoints[Math.min(k + 1, riverPoints.length - 1)];
      const prev = riverPoints[Math.max(k - 1, 0)];
      const t = new THREE.Vector3().subVectors(next, prev).normalize();
      const n = new THREE.Vector3(-t.z, 0, t.x);
      for (const side of [-1, 1]) {
        positions.push(p.x + n.x * 7.6 * side, WATER_LEVEL, p.z + n.z * 7.6 * side);
        uvs.push(side < 0 ? 0 : 1.5, k * 0.25);
      }
      if (k < riverPoints.length - 1) indices.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return { geometry: g, texture: waterTexture() };
  }, []);
  useFrame((_, dt) => {
    texture.offset.y -= dt * 0.12;
  });
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial map={texture} transparent opacity={0.88} roughness={0.12} metalness={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Vegetation() {
  const quality = useGame((s) => s.quality);
  const data = useMemo(() => {
    const random = rng(42);
    const trunks: Item[] = [];
    const round: Item[] = [];
    const cones: Item[] = [];
    const palmsTrunk: Item[] = [];
    const palmsLeaves: Item[] = [];
    const tea: Item[] = [];
    const paddies: Item[] = [];
    const rocks: Item[] = [];
    const grass: Item[] = [];
    const shapes: StaticShape[] = [];
    const leafGreens = ['#3f8f3a', '#4c9a3f', '#5aa64a', '#2f7a34', '#6bb04f', '#3a8442'];
    const pineGreens = ['#2e6b3a', '#285e34', '#367a40'];
    const pick = <T,>(arr: T[]) => arr[Math.floor(random() * arr.length)];

    // Rice terraces along the river: flat stepped plots, each at the ground height of its centre.
    for (let x = -half; x < half; x += 7.2) {
      for (let z = -half; z < half; z += 5.4) {
        const dRiver = riverDistance(x, z);
        if (dRiver < 10 || dRiver > 28) continue;
        const { d } = nearestRoute(x, z);
        if (d < ROAD_HALF + 8 || nearStation(x, z, 34)) continue;
        const h = terrainHeight(x, z);
        if (h < -0.2 || h > 9) continue;
        const roll = random();
        const color = roll < 0.12 ? '#d6c25a' : roll < 0.24 ? '#86b8a4' : pick(['#7cc242', '#8fcf4c', '#6fb83c', '#9ad45a']);
        paddies.push({ matrix: matrix(x, h - 0.45, z, 0, 6.6, 1, 4.8), color });
      }
    }
    const isPaddy = (x: number, z: number) => {
      const d = riverDistance(x, z);
      return d > 9 && d < 29 && terrainHeight(x, z) < 9;
    };

    // Tea plantation rows on the northern-western hills.
    for (let x = -100; x < -20; x += 2.6) {
      for (let z = 14; z < 104; z += 1.8) {
        const h = terrainHeight(x, z);
        if (h < 1.2) continue;
        if (nearestRoute(x, z).d < 12 || nearStation(x, z, 30) || riverDistance(x, z) < 12) continue;
        if (tea.length > 700) break;
        tea.push({ matrix: matrix(x + (random() - 0.5) * 0.3, h + 0.35, z, random() * 6, 0.9 + random() * 0.25, 0.6, 0.85), color: pick(['#3f8f3a', '#4a9a40', '#56a548']) });
      }
    }
    const isTea = (x: number, z: number) => x > -102 && x < -18 && z > 12 && z < 106 && terrainHeight(x, z) > 1.2;

    let attempts = 0;
    while ((round.length + cones.length < 420 || palmsTrunk.length < 40) && attempts++ < 20000) {
      const x = (random() * 2 - 1) * half;
      const z = (random() * 2 - 1) * half;
      const { d } = nearestRoute(x, z);
      const dRiver = riverDistance(x, z);
      if (d < ROAD_HALF + 4 || dRiver < 9 || nearStation(x, z, 30)) continue;
      const h = terrainHeight(x, z);
      const s = 0.8 + random() * 0.7;
      if (dRiver < 18 && palmsTrunk.length < 40 && random() < 0.5) {
        const lean = random() * Math.PI * 2;
        palmsTrunk.push({ matrix: matrix(x, h + 3.6 * s, z, lean, 0.22 * s, 7.2 * s, 0.22 * s), color: '#8b6b4a' });
        palmsLeaves.push({ matrix: matrix(x, h + 7.3 * s, z, lean, 2.6 * s, 0.9 * s, 2.6 * s), color: pick(['#4f9a3a', '#5ca842']) });
        shapes.push({ type: 'cylinder', x, y: h + 2, z, r: 0.3, hh: 2 });
        continue;
      }
      if (isPaddy(x, z) || isTea(x, z)) continue;
      if (round.length + cones.length >= 420) continue;
      if (h > 3.5 && random() < 0.65) {
        cones.push({ matrix: matrix(x, h + 3.4 * s, z, random() * 6, 2.1 * s, 6.5 * s, 2.1 * s), color: pick(pineGreens) });
      } else {
        round.push({ matrix: matrix(x, h + 3.3 * s, z, random() * 6, 2.4 * s, 2.1 * s, 2.4 * s), color: pick(leafGreens) });
      }
      trunks.push({ matrix: matrix(x, h + 1.1 * s, z, 0, 0.32 * s, 2.4 * s, 0.32 * s), color: '#6e4f35' });
      if (d < 70) shapes.push({ type: 'cylinder', x, y: h + 1.5, z, r: 0.45 * s, hh: 1.5 });
    }

    for (let i = 0; i < 60; i++) {
      const x = (random() * 2 - 1) * half;
      const z = (random() * 2 - 1) * half;
      if (nearestRoute(x, z).d < ROAD_HALF + 3 || nearStation(x, z, 26)) continue;
      const s = 0.4 + random() * 1.4;
      rocks.push({ matrix: matrix(x, terrainHeight(x, z) + s * 0.25, z, random() * 6, s, s * 0.7, s * 1.2), color: pick(['#8a8d86', '#9a9c95', '#7c7f78']) });
    }

    for (let i = 0; i < 3000 && grass.length < 1600; i++) {
      const k = Math.floor(random() * ROUTE_COUNT);
      const f = routeFrame(k);
      const off = (ROAD_HALF + 1.8 + random() * 18) * (random() < 0.5 ? -1 : 1);
      const x = f.position.x + f.normal.x * off + (random() - 0.5) * 3;
      const z = f.position.z + f.normal.z * off + (random() - 0.5) * 3;
      if (nearestRoute(x, z).d < ROAD_HALF + 1.6 || riverDistance(x, z) < 8 || nearStation(x, z, 24)) continue;
      grass.push({ matrix: matrix(x, terrainHeight(x, z), z, random() * 6, 0.7 + random() * 0.8), color: pick(['#6fae45', '#7dbb4f', '#5f9e3c', '#8cc25a']) });
    }

    return { trunks, round, cones, palmsTrunk, palmsLeaves, tea, paddies, rocks, grass, shapes };
  }, []);
  useStaticColliders(data.shapes);

  const geo = useMemo(() => {
    const blade = new THREE.ConeGeometry(0.09, 0.9, 3);
    blade.translate(0, 0.45, 0);
    const tuft = new THREE.BufferGeometry();
    const parts = [0, 1, 2].map((k) => blade.clone().rotateZ((k - 1) * 0.35).rotateY(k * 2.1).translate((k - 1) * 0.12, 0, 0));
    const positions = parts.flatMap((p) => Array.from(p.toNonIndexed().attributes.position.array));
    tuft.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    tuft.computeVertexNormals();
    const palm = new THREE.ConeGeometry(1, 1, 7, 1, true);
    palm.rotateX(Math.PI);
    return {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.7, 1, 1, 6),
      ball: new THREE.IcosahedronGeometry(1, 1),
      cone: new THREE.ConeGeometry(1, 1, 7),
      bush: new THREE.IcosahedronGeometry(0.75, 0),
      rock: new THREE.DodecahedronGeometry(1, 0),
      palm,
      tuft,
    };
  }, []);
  const mats = useMemo(
    () => ({
      flat: new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }),
      leaves: windMaterial({ flatShading: true, roughness: 0.9 }, 0.04),
      paddy: new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
      grass: windMaterial({ roughness: 1, side: THREE.DoubleSide }, 0.22),
      palm: windMaterial({ flatShading: true, side: THREE.DoubleSide }, 0.05),
    }),
    [],
  );

  return (
    <>
      <Instances geometry={geo.cyl} material={mats.flat} items={data.trunks} />
      <Instances geometry={geo.ball} material={mats.leaves} items={data.round} />
      <Instances geometry={geo.cone} material={mats.leaves} items={data.cones} />
      <Instances geometry={geo.cyl} material={mats.flat} items={data.palmsTrunk} />
      <Instances geometry={geo.palm} material={mats.palm} items={data.palmsLeaves} />
      <Instances geometry={geo.bush} material={mats.leaves} items={data.tea} shadows={quality === 'high'} />
      <Instances geometry={geo.box} material={mats.paddy} items={data.paddies} shadows={false} />
      <Instances geometry={geo.rock} material={mats.flat} items={data.rocks} />
      {quality !== 'low' && <Instances geometry={geo.tuft} material={mats.grass} items={data.grass} shadows={false} />}
    </>
  );
}

/** Village houses in clusters between the stations. */
export function houseParts(x: number, z: number, facing: number, h: number, random: () => number) {
  const w = 5 + random() * 2.5;
  const d = 6 + random() * 2.5;
  const hh = 3 + random() * 0.8;
  const walls = ['#f4efe4', '#f1e3c8', '#dfe9e0', '#f3d9c7', '#e6e0f0', '#fdf3d1'];
  const roofs = ['#b5482f', '#a8432c', '#c0573a', '#8f3b2a', '#5d6670'];
  const wall = walls[Math.floor(random() * walls.length)];
  const roof = roofs[Math.floor(random() * roofs.length)];
  const local = (lx: number, ly: number, lz: number) => {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    return [x + lx * c + lz * s, ly, z - lx * s + lz * c] as const;
  };
  const [dx, , dz] = local(0, 0, d / 2 + 0.02);
  const [w1x, , w1z] = local(-w / 3.2, 0, d / 2 + 0.03);
  const [w2x, , w2z] = local(w / 3.2, 0, d / 2 + 0.03);
  return {
    body: { matrix: matrix(x, h + hh / 2 - 1, z, facing, w, hh + 2, d), color: wall },
    roof: { matrix: matrix(x, h + hh - 1 + 1.1, z, facing, w + 0.9, 2.2, d + 0.9), color: roof },
    door: { matrix: matrix(dx, h + 0.95, dz, facing, 1.1, 1.9, 0.1), color: '#6b4426' },
    windows: [
      { matrix: matrix(w1x, h + 1.6, w1z, facing, 1, 0.9, 0.1), color: '#9cc6d8' },
      { matrix: matrix(w2x, h + 1.6, w2z, facing, 1, 0.9, 0.1), color: '#9cc6d8' },
    ],
    collider: { type: 'cuboid', x, y: h + hh / 2, z, rotY: facing, hx: w / 2, hy: hh / 2 + 1, hz: d / 2 } as StaticShape,
  };
}

export function roofGeometry() {
  // Gable roof: triangular prism, ridge along local X.
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(0, 0.5);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  g.rotateY(Math.PI / 2);
  return g;
}

function Villages() {
  const data = useMemo(() => {
    const random = rng(99);
    const bodies: Item[] = [];
    const roofs: Item[] = [];
    const doors: Item[] = [];
    const windows: Item[] = [];
    const shapes: StaticShape[] = [];
    const placed: THREE.Vector2[] = [];
    const clusters = [26, 91, 166, 234, 303, 371];
    for (const center of clusters) {
      for (let n = 0; n < 30 && placed.length < (clusters.indexOf(center) + 1) * 7; n++) {
        const k = center + Math.floor((random() - 0.5) * 40);
        const f = routeFrame(k);
        const side = random() < 0.5 ? -1 : 1;
        const off = ROAD_HALF + 8 + random() * 8;
        const x = f.position.x + f.normal.x * off * side + (random() - 0.5) * 4;
        const z = f.position.z + f.normal.z * off * side + (random() - 0.5) * 4;
        if (nearestRoute(x, z).d < ROAD_HALF + 7 || riverDistance(x, z) < 13 || nearStation(x, z, 30) || isBridgeSample(f.index) || Math.max(Math.abs(x), Math.abs(z)) > half - 4) continue;
        if (placed.some((p) => p.distanceTo(new THREE.Vector2(x, z)) < 10)) continue;
        const h = terrainHeight(x, z);
        if (Math.abs(terrainHeight(x + 3, z + 3) - h) > 1.2) continue;
        // Face the road.
        const facing = Math.atan2(-f.normal.x * side, -f.normal.z * side);
        const p = houseParts(x, z, facing, h, random);
        bodies.push(p.body);
        roofs.push(p.roof);
        doors.push(p.door);
        windows.push(...p.windows);
        shapes.push(p.collider);
        placed.push(new THREE.Vector2(x, z));
      }
    }
    return { bodies, roofs, doors, windows, shapes };
  }, []);
  useStaticColliders(data.shapes);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const roof = useMemo(roofGeometry, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), []);
  return (
    <>
      <Instances geometry={box} material={mat} items={data.bodies} />
      <Instances geometry={roof} material={mat} items={data.roofs} />
      <Instances geometry={box} material={mat} items={data.doors} shadows={false} />
      <Instances geometry={box} material={mat} items={data.windows} shadows={false} />
    </>
  );
}

export function World() {
  useFrame((_, dt) => {
    windTime.value += dt;
  });
  return (
    <>
      <Terrain />
      <Road />
      <River />
      <Vegetation />
      <Villages />
    </>
  );
}

export const routeHeightAt = (index: number) => routeY[((index % ROUTE_COUNT) + ROUTE_COUNT) % ROUTE_COUNT];
