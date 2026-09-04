import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import type { Dependencies } from '../app/Dependencies';
import { DependencyProvider } from '../app/DependencyContext';
import { RouteRegistry } from '../app/RouteRegistry';
import { ROUTES } from '../generated/RouteBinding';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';
import { Loading } from '../shared/ui/Loading';
import { NotFound } from './RouteError';

export function Router({ dependencies }: Readonly<{ dependencies: Dependencies }>) {
  return (
    <DependencyProvider value={dependencies}>
      <BrowserRouter>
        <Suspense
          fallback={
            <AuthShell>
              <AuthCard stage={1} onBack={() => undefined}>
                <Loading label="正在初始化安全登录…" />
              </AuthCard>
            </AuthShell>
          }
        >
          <Routes>
            {RouteRegistry.all().map((manifest) => {
              const Component = lazy(() => manifest.load().then((module) => ({ default: module.Component })));
              return <Route key={manifest.routeid} path={ROUTES[manifest.routeid]} element={<Component />} />;
            })}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DependencyProvider>
  );
}
