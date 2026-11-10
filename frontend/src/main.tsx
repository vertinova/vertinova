import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing';
import './styles.css';

// Client proposal pages live on their own path and are only downloaded when visited.
const Rempah = lazy(() => import('./rempah/RempahPage'));
const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/rempah' ? (
      <Suspense fallback={null}>
        <Rempah />
      </Suspense>
    ) : (
      <Landing />
    )}
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
