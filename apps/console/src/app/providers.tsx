import { AppBoundary } from '@shop/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConsoleApp } from './ConsoleApp';

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
        <ConsoleApp />
      </QueryClientProvider>
    </AppBoundary>
  );
}
