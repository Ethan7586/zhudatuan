import vinext from 'vinext';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const localBindingConfig = {
  main: './worker/index.ts',
  compatibility_date: '2026-07-24',
  compatibility_flags: ['nodejs_compat'],
};

const productionDemoAuthModule = fileURLToPath(new URL('./src/config/productionDemoAuth.ts', import.meta.url));

export default defineConfig(async ({ command }) => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    plugins: [
      {
        name: 'production-demo-auth-hard-cut',
        enforce: 'pre',
        resolveId(source: string, importer?: string) {
          if (command !== 'build' || source !== './demoAuth' || !importer?.includes('/services/commerce-api/src/api/')) return null;
          return productionDemoAuthModule;
        },
      },
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
    build: {
      cssMinify: 'lightningcss' as const,
      cssTarget: 'chrome61',
    },
    server: {
      fs: {
        allow: ['..', '../..', '../../..'],
      },
    },
  };
});
