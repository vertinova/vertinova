import { lazy, Suspense, useState } from 'react';
import LandingLite from './LandingLite';
import './landing.css';

const Experience = lazy(() => import('./Experience'));

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Landing() {
  const webgl = hasWebGL();
  const [mode, setMode] = useState<'3d' | 'lite'>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'lite') return 'lite';
    if (!webgl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite';
    return '3d';
  });

  if (mode === 'lite') return <LandingLite onOpen3D={webgl ? () => setMode('3d') : undefined} />;

  return (
    <Suspense fallback={<div className="vx-boot" aria-busy="true" />}>
      <Experience onLite={() => setMode('lite')} />
    </Suspense>
  );
}
