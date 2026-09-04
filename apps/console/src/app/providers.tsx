import { AppBoundary, RouteLoading } from '@shop/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BROWSER_QUERY_POLICY } from '@shop/config/runtime';
import { lazy, Suspense, useState } from 'react';
import { createConsoleDependencies, type ConsoleDependencies } from './Dependencies';
import { DependencyProvider } from './DependencyContext';

const ConsoleApp = lazy(() => import('./ConsoleApp').then((module) => ({ default: module.ConsoleApp })));

export function createConsoleQueryClient(): QueryClient {
  const policy = BROWSER_QUERY_POLICY.query;
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: policy.retryCount,
        staleTime: policy.staleMilliseconds,
        gcTime: policy.garbageCollectionMilliseconds,
        refetchOnWindowFocus: policy.refetchOnWindowFocus,
        refetchOnReconnect: policy.refetchOnReconnect,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ client, dependencies }: Readonly<{ client?: QueryClient; dependencies?: ConsoleDependencies }>) {
  const [defaultClient] = useState(createConsoleQueryClient);
  const [defaultDependencies] = useState(createConsoleDependencies);
  return (
    <AppBoundary>
      <DependencyProvider value={dependencies ?? defaultDependencies}>
        <QueryClientProvider client={client ?? defaultClient}>
          <Suspense fallback={<RouteLoading />}>
            <ConsoleApp />
          </Suspense>
        </QueryClientProvider>
      </DependencyProvider>
    </AppBoundary>
  );
}
