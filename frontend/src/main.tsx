import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './landing';
import './styles.css';

// Extra pages (client demos/proposals) live on their own paths and are only downloaded when visited.
const PAGES: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  '/rempah': lazy(() => import('./rempah/demo/RempahDemo')),
  '/rempah/usulan': lazy(() => import('./rempah/RempahPage')),
};
const Page = PAGES[window.location.pathname.replace(/\/+$/, '')];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Page ? (
      <Suspense fallback={null}>
        <Page />
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
