import { AppBoundary, RouteFallback } from '@shop/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

const ConsoleApp = lazy(() => import('./ConsoleApp').then((module) => ({ default: module.ConsoleApp })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export function Providers() {
  return (
    <AppBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<RouteFallback />}>
          <ConsoleApp />
        </Suspense>
      </QueryClientProvider>
    </AppBoundary>
  );
}
