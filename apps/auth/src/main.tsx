import { Component, lazy, StrictMode, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClientError } from '@shop/sdk';
import './app/Auth.css';

const App = lazy(() => import('./app/App'));

function BootStatus() {
  return <main className="authboot" role="status" aria-live="polite"><span className="authbootmark" aria-hidden="true">翼</span><span>正在初始化安全登录…</span></main>;
}

class ChunkBoundary extends Component<Readonly<{ children: ReactNode }>, Readonly<{ failed: boolean }>> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(_cause: unknown, _info: ErrorInfo): void {}
  override render() {
    if (!this.state.failed) return this.props.children;
    return <main className="authboot" role="alert"><span className="authbootmark" aria-hidden="true">翼</span><strong>安全登录暂时未能载入</strong><button type="button" onClick={() => window.location.reload()}>重新载入</button></main>;
  }
}

const root = document.getElementById('root');
if (!root) throw new ClientError('ROOT_MISSING');
createRoot(root).render(
  <StrictMode>
    <ChunkBoundary><Suspense fallback={<BootStatus />}><App /></Suspense></ChunkBoundary>
  </StrictMode>
);
