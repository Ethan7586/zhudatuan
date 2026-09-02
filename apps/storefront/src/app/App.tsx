import { SessionRuntime } from './SessionRuntime';
import { Router } from '../route/Router';
import { BrowserRouter } from 'react-router';
import { readEntryPath } from '../route/EntryPath';

export function App() {
  let entry;
  try {
    entry = readEntryPath(window.location.pathname);
  } catch {
    return <EntryFailure />;
  }
  return (
    <BrowserRouter basename={entry.basePath}>
      <SessionRuntime entry={entry}>
        <Router />
      </SessionRuntime>
    </BrowserRouter>
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
