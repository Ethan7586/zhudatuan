import react from '@vitejs/plugin-react';
import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import { networkHtml } from '@shop/config/networkhtml';
import tokens from '@shop/design/tokens.json';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // Relative assets keep the reviewed Auth artifact independent of its mount path.
    base: command === 'build' ? './' : '/',
    plugins: [
      react(),
      { name: 'network-html', transformIndexHtml: networkHtml },
      { name: 'design-html', transformIndexHtml: (source) => source.replaceAll('%THEME_COLOR%', tokens.color.brand.dark) },
    ],
    build: { manifest: true },
    server: {
      host: '127.0.0.1',
      port: 3002,
      // Keep the development server stable when a CI-like environment disables HMR.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    // Keep the explicit host allowlist; do not turn on allowHosts: true.
    preview: {
      allowedHosts: Object.values(NETWORK_CATALOG.origins).map((origin) => new URL(origin).hostname),
    },
  };
});
