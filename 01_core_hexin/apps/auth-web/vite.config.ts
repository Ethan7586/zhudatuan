import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { validateAuthBuildEnvironment } from './src/buildEnvironment';

export default defineConfig(({ command, mode }) => {
  let identityNodeRegistrySource: string | undefined;
  if (command === 'build') {
    identityNodeRegistrySource = validateAuthBuildEnvironment(loadEnv(mode, __dirname, '')).identityNodeRegistrySource;
  }

  return {
    // Relative assets let the same reviewed dist run at a node identity host
    // and at the storefront's optional /login/ mount.
    base: command === 'build' ? './' : '/',
    plugins: [react(), tailwindcss()],
    ...(identityNodeRegistrySource === undefined ? {} : {
      define: {
        'import.meta.env.VITE_IDENTITY_NODE_REGISTRY': JSON.stringify(identityNodeRegistrySource),
      },
    }),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3002,
      proxy: {
        '/api': {
          // Auth endpoints live on the storefront compatibility BFF, not the
          // canonical Commerce API (:3001).
          target: process.env.AUTH_COMPAT_API_ORIGIN ?? 'http://127.0.0.1:3000',
          changeOrigin: false,
        },
      },
      // Keep the development server stable when a CI-like environment disables HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Keep the explicit host allowlist; do not turn on allowHosts: true.
    preview: {
      allowedHosts: [...new Set(PRODUCTION_IDENTITY_NODE_REGISTRY.nodes.flatMap((node) => [
        node.accountsHost,
        ...node.storefrontHosts,
        ...(node.adminOrigin === null ? [] : [new URL(node.adminOrigin).hostname]),
      ]))],
    },
  };
});
