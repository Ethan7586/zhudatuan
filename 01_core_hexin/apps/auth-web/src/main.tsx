import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { configuredIdentityNode, loadIdentityNodeRuntime } from './services/identityNodeEnvironment';
import './index.css';

const root = createRoot(document.getElementById('root')!);
let renderedFromBuild = false;

const renderApp = () => {
  if (renderedFromBuild) return;
  renderedFromBuild = true;
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
};

try {
  if (configuredIdentityNode() !== null) renderApp();
} catch {
  // A runtime-only node is rendered as soon as its same-origin registry arrives.
}

void loadIdentityNodeRuntime().then(() => {
  renderApp();
}).catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'IDENTITY_NODE_RUNTIME_INVALID';
  root.render(
    <main>身份节点运行配置不可用：{message}</main>
  );
});
