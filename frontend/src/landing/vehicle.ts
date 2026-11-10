// Shared vehicle tuning. No imports so it can also be run by the Node physics self-check (scripts/vehicle-sim.mjs).
// Car local frame: +X forward, +Y up, +Z right side axle.

// Offroad 4x4: big wheels, long suspension travel, all-wheel drive.
export const CHASSIS_HALF = [2.6, 0.62, 1.25] as const;
export const CHASSIS_MASS = 520;
export const WHEEL_RADIUS = 0.66;
export const WHEEL_WIDTH = 0.56;
export const WHEEL_REST = 0.6;
export const MAX_STEER = 0.6;
export const ENGINE_FORCE = 640; // per wheel, 4WD
export const REVERSE_FORCE = 380;
export const BRAKE_FORCE = 26;
export const HANDBRAKE_FORCE = 48;
export const MAX_SPEED = 20; // m/s ≈ 72 km/h
export const MAX_REVERSE_SPEED = 7;

export const WHEELS = [
  { x: 1.72, y: -0.32, z: -1.3, front: true },
  { x: 1.72, y: -0.32, z: 1.3, front: true },
  { x: -1.68, y: -0.32, z: -1.3, front: false },
  { x: -1.68, y: -0.32, z: 1.3, front: false },
] as const;

type Vec = { x: number; y: number; z: number };

export type VehicleLike = {
  addWheel(connection: Vec, direction: Vec, axle: Vec, restLength: number, radius: number): void;
  setWheelSuspensionStiffness(i: number, v: number): void;
  setWheelSuspensionCompression(i: number, v: number): void;
  setWheelSuspensionRelaxation(i: number, v: number): void;
  setWheelMaxSuspensionTravel(i: number, v: number): void;
  setWheelMaxSuspensionForce(i: number, v: number): void;
  setWheelFrictionSlip(i: number, v: number): void;
  setWheelSideFrictionStiffness(i: number, v: number): void;
  setWheelSteering(i: number, v: number): void;
  setWheelEngineForce(i: number, v: number): void;
  setWheelBrake(i: number, v: number): void;
  currentVehicleSpeed(): number;
};

export function setupWheels(vehicle: VehicleLike) {
  WHEELS.forEach((wheel, i) => {
    vehicle.addWheel({ x: wheel.x, y: wheel.y, z: wheel.z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, WHEEL_REST, WHEEL_RADIUS);
    vehicle.setWheelSuspensionStiffness(i, 24);
    vehicle.setWheelSuspensionCompression(i, 2.2);
    vehicle.setWheelSuspensionRelaxation(i, 3.2);
    vehicle.setWheelMaxSuspensionTravel(i, 0.55);
    vehicle.setWheelMaxSuspensionForce(i, 100000);
    vehicle.setWheelFrictionSlip(i, wheel.front ? 2.8 : 2.5);
    vehicle.setWheelSideFrictionStiffness(i, 1.15);
  });
}

export type DriveInput = { throttle: number; steer: number; handbrake: boolean; autoBrake: boolean };

/** Applies one tick of driver input. Returns the steering angle actually used. */
export function applyDrive(vehicle: VehicleLike, input: DriveInput, currentSteer: number, dt: number) {
  const speed = vehicle.currentVehicleSpeed();
  // Less steering lock at speed keeps the car controllable with keyboard input.
  const steerLimit = MAX_STEER * (1 - Math.min(Math.abs(speed) / MAX_SPEED, 1) * 0.55);
  const targetSteer = input.steer * steerLimit;
  const steer = currentSteer + (targetSteer - currentSteer) * Math.min(1, dt * 8);

  let engine = 0;
  let brake = 0;

  if (input.autoBrake) {
    brake = BRAKE_FORCE * 1.6;
  } else if (input.throttle > 0) {
    if (speed < -0.5) brake = BRAKE_FORCE;
    else if (speed < MAX_SPEED) engine = ENGINE_FORCE * input.throttle;
  } else if (input.throttle < 0) {
    if (speed > 0.5) brake = BRAKE_FORCE;
    else if (speed > -MAX_REVERSE_SPEED) engine = -REVERSE_FORCE * -input.throttle;
  } else {
    brake = 1.2; // engine braking / rolling resistance
  }

  WHEELS.forEach((wheel, i) => {
    vehicle.setWheelSteering(i, wheel.front ? steer : 0);
    vehicle.setWheelEngineForce(i, engine);
    vehicle.setWheelBrake(i, input.handbrake && !wheel.front ? HANDBRAKE_FORCE : brake);
  });

  return steer;
}
