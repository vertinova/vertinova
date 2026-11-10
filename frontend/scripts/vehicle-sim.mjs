// Headless physics self-check for the landing-page car. Run: node scripts/vehicle-sim.mjs (Node >= 23 for .ts imports).
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { CHASSIS_HALF, CHASSIS_MASS, applyDrive, setupWheels } from '../src/landing/vehicle.ts';

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(500, 0.5, 500).setTranslation(0, -0.5, 0));

const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setLinearDamping(0.12).setAngularDamping(0.8));
world.createCollider(RAPIER.ColliderDesc.cuboid(...CHASSIS_HALF).setMass(CHASSIS_MASS), body);
const vehicle = world.createVehicleController(body);
setupWheels(vehicle);

const dt = 1 / 60;
let steer = 0;
const run = (seconds, input) => {
  for (let i = 0; i < seconds * 60; i++) {
    steer = applyDrive(vehicle, { handbrake: false, autoBrake: false, ...input }, steer, dt);
    vehicle.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
    world.step();
  }
};
const yaw = () => {
  const q = body.rotation();
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
};
const fmt = (v) => v.toFixed(2);

run(1.5, { throttle: 0, steer: 0 });
const rest = body.translation();
console.log('settled y', fmt(rest.y));
assert.ok(rest.y > 0.6 && rest.y < 2, 'chassis rests on its wheels');

run(4, { throttle: 1, steer: 0 });
const p1 = body.translation();
console.log('after 4s throttle: speed', fmt(vehicle.currentVehicleSpeed()), 'x', fmt(p1.x), 'z', fmt(p1.z));
assert.ok(vehicle.currentVehicleSpeed() > 10, 'accelerates');
assert.ok(p1.x > 15, 'drives toward +X (forward)');

run(6, { throttle: 1, steer: 0 });
console.log('top speed', fmt(vehicle.currentVehicleSpeed()));
assert.ok(vehicle.currentVehicleSpeed() < 27, 'respects max speed');

const yaw0 = yaw();
run(2, { throttle: 0.6, steer: 1 });
console.log('yaw change steering +1 for 2s', fmt(yaw() - yaw0), 'tilt up.y', fmt(body.rotation().w));
assert.ok(Math.abs(yaw() - yaw0) > 0.5, 'turns');
const leftYawSign = Math.sign(yaw() - yaw0);

run(3, { throttle: 0, steer: 0 });
const before = vehicle.currentVehicleSpeed();
let stopTime = 0;
while (vehicle.currentVehicleSpeed() > 0.5 && stopTime < 5) {
  run(0.1, { throttle: -1, steer: 0 });
  stopTime += 0.1;
}
console.log('brake: from', fmt(before), 'm/s stopped in', fmt(stopTime), 's');
assert.ok(stopTime < 3, 'brakes to a stop quickly');

run(3, { throttle: -1, steer: 0 });
console.log('reverse speed', fmt(vehicle.currentVehicleSpeed()));
assert.ok(vehicle.currentVehicleSpeed() < -2, 'reverses');

run(1, { throttle: 0, steer: 0 });
run(5, { throttle: 1, steer: 0 });
run(3, { throttle: 0, steer: 0, autoBrake: true });
console.log('auto brake speed', fmt(vehicle.currentVehicleSpeed()));
assert.ok(Math.abs(vehicle.currentVehicleSpeed()) < 0.6, 'auto brake stops the car');

const up = body.rotation();
assert.ok(Math.abs(up.x) < 0.2 && Math.abs(up.z) < 0.2, 'did not roll over');
console.log('steer +1 yaw sign', leftYawSign, '(positive = turns left when viewed from above with +X forward)');
console.log('OK');
