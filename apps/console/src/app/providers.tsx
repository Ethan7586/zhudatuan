import { AppBoundary, Button, RouteLoading, useResourceQuery } from '@shop/design';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BROWSER_QUERY_POLICY } from '@shop/config/runtime';
import { useCallback, useState } from 'react';
import type { ConsoleDependencies } from './Dependencies';
import { DependencyProvider } from './DependencyContext';

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
  return (
    <AppBoundary>
      <QueryClientProvider client={client ?? defaultClient}>
        <DependencyRuntime {...(dependencies === undefined ? {} : { dependencies })} />
      </QueryClientProvider>
    </AppBoundary>
  );
}

function DependencyRuntime({ dependencies }: Readonly<{ dependencies?: ConsoleDependencies }>) {
  const load = useCallback(async (signal: AbortSignal) => {
    const module = await import('./LoadDependencies');
    if (signal.aborted) throw signal.reason;
    return module.loadConsoleApplication(dependencies);
  }, [dependencies]);
  const query = useResourceQuery('consoledependencies', load);
  if (query.data === undefined) {
    if (query.error !== undefined) {
      return (
        <main className="statemain" role="alert">
          <strong>控制台初始化失败</strong>
          <p>业务模块暂时未能载入，请重新尝试。</p>
          <Button tone="primary" onPress={query.reload}>重新载入</Button>
        </main>
      );
    }
    return <RouteLoading />;
  }
  const { Component, dependencies: loaded } = query.data;
  return <DependencyProvider value={loaded}><Component /></DependencyProvider>;
}
