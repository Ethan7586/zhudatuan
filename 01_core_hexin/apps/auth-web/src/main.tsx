import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { loadIdentityNodeRuntime } from './services/identityNodeEnvironment';
import './index.css';

void loadIdentityNodeRuntime().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}).catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'IDENTITY_NODE_RUNTIME_INVALID';
  createRoot(document.getElementById('root')!).render(
    <main>身份节点运行配置不可用：{message}</main>
  );
});
