import { Button, useResourceQuery } from '@shop/design';
import { SessionRuntime } from './SessionRuntime';
import { Router } from '../route/Router';
import { BrowserRouter } from 'react-router';
import { readEntryPath } from '../route/EntryPath';
import { useCallback } from 'react';
import { DependencyProvider } from './DependencyContext';

export function App() {
  let entry;
  try {
    entry = readEntryPath(window.location.pathname);
  } catch {
    return <EntryFailure />;
  }
  return <StorefrontRuntime entry={entry} />;
}

function StorefrontRuntime({ entry }: Readonly<{ entry: ReturnType<typeof readEntryPath> }>) {
  const load = useCallback(async (signal: AbortSignal) => {
    const module = await import('./Dependencies');
    if (signal.aborted) throw signal.reason;
    return module.createDependencies(entry.handle);
  }, [entry.handle]);
  const query = useResourceQuery(`storefrontdependencies:${entry.handle}`, load);
  if (query.data === undefined) {
    if (query.error !== undefined) {
      return (
        <main className="storefrontloading" role="alert">
          <strong>商城暂时未能载入</strong>
          <p>请检查网络后重新尝试。</p>
          <Button tone="primary" onPress={query.reload}>重新载入</Button>
        </main>
      );
    }
    return <main className="storefrontloading" role="status">正在准备商城服务…</main>;
  }
  return (
    <DependencyProvider value={query.data}>
      <BrowserRouter basename={entry.basePath}>
        <SessionRuntime entry={entry}>
          <Router />
        </SessionRuntime>
      </BrowserRouter>
    </DependencyProvider>
  );
}

function EntryFailure() {
  return (
    <main className="storefrontloading" role="alert">
      <strong>商城地址无效</strong>
      <p>请重新扫描管理员提供的商城二维码。</p>
    </main>
  );
}
