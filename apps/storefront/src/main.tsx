import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = lazy(() => import('./app/App').then((module) => ({ default: module.App })));
const root = document.getElementById('root');
if (root === null) throw new Error('STOREFRONT_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<main className="storefrontloading">正在加载福利商城…</main>}>
      <App />
    </Suspense>
  </StrictMode>
);
