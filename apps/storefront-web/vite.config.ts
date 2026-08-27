import vinext from 'vinext';
import { defineConfig } from 'vite';

const localBindingConfig = {
  main: './worker/index.ts',
  compatibility_date: '2026-07-24',
  compatibility_flags: ['nodejs_compat'],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
    server: {
      fs: {
        allow: ['..', '../..', '../../..'],
      },
    },
  };
});
