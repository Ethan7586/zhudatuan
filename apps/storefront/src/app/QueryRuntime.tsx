import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function createStorefrontQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 300_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

export function QueryRuntime({ children }: { readonly children: ReactNode }) {
  const [client] = useState(createStorefrontQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
