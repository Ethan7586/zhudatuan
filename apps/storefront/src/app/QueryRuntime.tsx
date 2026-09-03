import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BROWSER_QUERY_POLICY } from '@shop/config/runtime';
import { useState, type ReactNode } from 'react';

export function createStorefrontQueryClient(): QueryClient {
  const policy = BROWSER_QUERY_POLICY.query;
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: policy.staleMilliseconds,
        gcTime: policy.garbageCollectionMilliseconds,
        retry: policy.retryCount,
        refetchOnWindowFocus: policy.refetchOnWindowFocus,
        refetchOnReconnect: policy.refetchOnReconnect,
      },
      mutations: { retry: false },
    },
  });
}

export function QueryRuntime({ children }: { readonly children: ReactNode }) {
  const [client] = useState(createStorefrontQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
