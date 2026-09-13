import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { configuredIdentityNode, loadIdentityNodeRuntime } from './services/identityNodeEnvironment';
import type { IdentityNodeDefinition } from '@shop/sdk/identity-node';
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

const warmIdentityConnections = (node: IdentityNodeDefinition) => {
  const params = new URLSearchParams(window.location.search);
  const consumer = params.get('target') === node.consumerTarget
    && params.get('application') === node.consumerApplication;
  const origins = consumer
    ? [node.consumerApiOrigin, node.storefrontOrigin]
    : [node.apiOrigin, node.adminOrigin];
  for (const origin of new Set(origins)) {
    if (origin === null || origin === window.location.origin
      || document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'use-credentials';
    document.head.append(link);
  }
};

try {
  const node = configuredIdentityNode();
  if (node !== null) {
    warmIdentityConnections(node);
    renderApp();
  }
} catch {
  // A runtime-only node is rendered as soon as its same-origin registry arrives.
}

if (!renderedFromBuild) {
  void loadIdentityNodeRuntime().then(() => {
    const node = configuredIdentityNode();
    if (node !== null) warmIdentityConnections(node);
    renderApp();
  }).catch((cause: unknown) => {
    const message = cause instanceof Error ? cause.message : 'IDENTITY_NODE_RUNTIME_INVALID';
    root.render(
      <main>身份节点运行配置不可用：{message}</main>
    );
  });
}
