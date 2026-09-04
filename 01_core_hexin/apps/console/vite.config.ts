import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const build = buildDefinition();
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __SHOP_BUILD_COMMIT__: JSON.stringify(build.commit),
      __SHOP_BUILD_BRANCH__: JSON.stringify(build.branch),
      __SHOP_BUILD_ID__: JSON.stringify(build.id),
      __SHOP_BUILD_DIRTY__: JSON.stringify(build.dirty),
    },
    build: { manifest: true },
    server: {
      port: 5173,
      /**
       * In production Caddy reverse-proxies console.zhudatuan.com/api/* to the commerce
       * runtime. The dev server must do the same or every authenticated request
       * would hit the Vite server itself and fail.
       */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
      // Automated environments may disable HMR and watching to reduce background work.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

const repositoryRoot = resolve(import.meta.dirname, '../../..');

function buildDefinition(): Readonly<{ commit: string; branch: string; id: string; dirty: boolean }> {
  const commit = process.env.SHOP_BUILD_COMMIT?.trim() || git(['rev-parse', 'HEAD']);
  const branch = process.env.SHOP_BUILD_BRANCH?.trim() || git(['branch', '--show-current']) || 'detached';
  const dirty = process.env.SHOP_BUILD_DIRTY === undefined ? git(['status', '--porcelain', '--untracked-files=no']).length > 0 : process.env.SHOP_BUILD_DIRTY === 'true';
  const id = process.env.SHOP_BUILD_ID?.trim() || `${commit.slice(0, 12)}${dirty ? '-dirty' : ''}`;
  return Object.freeze({ commit, branch, id, dirty });
}

function git(arguments_: readonly string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...arguments_], { encoding: 'utf8' }).trim();
}
