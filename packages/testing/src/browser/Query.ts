import { QueryClient, QueryClientProvider, type QueryClientConfig } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

export function createTestQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        ...config.defaultOptions?.queries,
      },
      mutations: {
        retry: false,
        ...config.defaultOptions?.mutations,
      },
    },
  });
}

export function QueryHarness({ client, children }: Readonly<{ client: QueryClient; children: ReactNode }>) {
  return createElement(QueryClientProvider, { client }, children);
}
