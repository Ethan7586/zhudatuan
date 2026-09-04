import { SessionRuntime } from './SessionRuntime';
import { Router } from '../route/Router';
import { BrowserRouter } from 'react-router';
import { readEntryPath } from '../route/EntryPath';
import { useMemo } from 'react';
import { createDependencies } from './Dependencies';
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
  const dependencies = useMemo(() => createDependencies(entry.handle), [entry.handle]);
  return (
    <DependencyProvider value={dependencies}>
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
