import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyModule } from '@shop/kernel';
import { ErrorBoundary } from './app/ErrorBoundary';
import { QueryRuntime } from './app/QueryRuntime';
import { storefrontDependencies } from './app/Modules';
import './index.css';

const application = new LazyModule(() => import('./app/App').then((module) => ({ default: module.App })));
application.preload();
storefrontDependencies.preload();
const App = lazy(() => application.load());
const root = document.getElementById('root');
if (root === null) throw new Error('STOREFRONT_ROOT_MISSING');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryRuntime>
        <Suspense fallback={<main className="storefrontloading">正在加载福利商城…</main>}>
          <App />
        </Suspense>
      </QueryRuntime>
    </ErrorBoundary>
  </StrictMode>
);
