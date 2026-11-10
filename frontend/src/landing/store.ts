import { useSyncExternalStore } from 'react';
import * as THREE from 'three';

export type Phase = 'loading' | 'intro' | 'driving' | 'arriving' | 'station';
export type Quality = 'low' | 'medium' | 'high';

type State = {
  phase: Phase;
  activeStation: string | null;
  visited: string[];
  quality: Quality;
  autoQuality: boolean;
  muted: boolean;
  camera: 'chase' | 'top';
  help: boolean;
};

let state: State = {
  phase: 'loading',
  activeStation: null,
  visited: [],
  quality: 'high',
  autoQuality: true,
  muted: true,
  camera: 'chase',
  help: false,
};
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<State> | ((s: State) => Partial<State>)) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useGame<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(state));
}

export function openStation(id: string) {
  store.set((s) => ({
    phase: 'station',
    activeStation: id,
    visited: s.visited.includes(id) ? s.visited : [...s.visited, id],
  }));
}

/** Leaves the station panel; the car must drive away (see Car) before that station can trigger again. */
export function leaveStation() {
  const id = state.activeStation;
  if (id) dismissed.add(id);
  store.set({ phase: 'driving', activeStation: null });
}

export const dismissed = new Set<string>(['gate']);

// Per-frame values written by the scene and read by the HUD without React re-renders.
export const car = {
  position: new THREE.Vector3(),
  forward: new THREE.Vector3(1, 0, 0),
  speed: 0,
  throttle: 0,
};

export const input = { up: false, down: false, left: false, right: false, handbrake: false, touchSteer: 0, touchThrottle: 0 };

export const commands = { reset: false, teleport: null as string | null };
