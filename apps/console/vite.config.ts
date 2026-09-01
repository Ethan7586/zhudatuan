import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';

const consoleRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];
  const source = { ...loadEnv(mode, consoleRoot, ''), ...process.env };
  const build = buildIdentity(source);
  if (command === 'build') {
    const environment = clientBuildEnvironment(source);
    plugins.push(
      consoleAfterPaintBootstrapPlugin(),
      consoleArtifactPlugin({
        schema: 'shop.console-artifact.v1',
        ...build,
        ...environment,
      })
    );
  }
  return {
    envDir: consoleRoot,
    plugins,
    define: {
      __SHOP_BUILD_COMMIT__: JSON.stringify(build.commit),
      __SHOP_BUILD_BRANCH__: JSON.stringify(build.branch),
      __SHOP_BUILD_ID__: JSON.stringify(build.id),
      __SHOP_BUILD_DIRTY__: JSON.stringify(build.sourceTree === 'dirty'),
    },
    build: { manifest: true },
    server: {
      port: 4173,
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

function consoleAfterPaintBootstrapPlugin(): Plugin {
  const preloadModules = [
    './src/app/providers.tsx',
    './src/components/Sidebar.tsx',
    './src/feature/cockpit/CockpitRoute.tsx',
  ].map((modulePath) => fileURLToPath(new URL(modulePath, import.meta.url)));
  return {
    name: 'shop-console-after-paint-bootstrap',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (context.bundle === undefined) return html;
        const bundle = context.bundle;
        const preloadChunks = preloadModules.map((modulePath) => Object.values(bundle).find((output) => output.type === 'chunk'
          && output.facadeModuleId === modulePath));
        if (preloadChunks.some((output) => output === undefined || output.type !== 'chunk')) {
          throw new Error('CONSOLE_STARTUP_CHUNK_MISSING');
        }
        const files: string[] = [];
        const visited = new Set<string>();
        const visit = (fileName: string) => {
          if (visited.has(fileName) || html.includes(`"/${fileName}"`)) return;
          visited.add(fileName);
          const output = bundle[fileName];
          if (output === undefined || output.type !== 'chunk' || output.isEntry) return;
          files.push(`/${fileName}`);
          for (const dependency of output.imports) visit(dependency);
        };
        for (const output of preloadChunks) {
          if (output !== undefined && output.type === 'chunk') visit(output.fileName);
        }
        return {
          html,
          tags: [{
            tag: 'script',
            attrs: { type: 'module' },
            children: `const f=${JSON.stringify(files)},s=document.querySelector('link[rel="stylesheet"][href*="/assets/"]');const w=()=>requestAnimationFrame(()=>{for(const h of f){const l=document.createElement('link');l.rel='modulepreload';l.crossOrigin='anonymous';l.href=h;document.head.append(l)}});s?.sheet?w():s?s.addEventListener('load',w,{once:true}):w();`,
            injectTo: 'head-prepend',
          }],
        };
      },
    },
  };
}

function clientBuildEnvironment(source: Readonly<Record<string, string | undefined>>) {
  const apiBaseUrl = required(source.VITE_API_BASE_URL, 'CLIENT_API_BASE_URL_MISSING');
  const authBaseUrl = required(source.VITE_AUTH_BASE_URL, 'CLIENT_AUTH_BASE_URL_MISSING');
  const clientVersion = required(source.VITE_CLIENT_VERSION, 'CLIENT_VERSION_MISSING');
  if (!/^https:\/\//.test(apiBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiBaseUrl)) {
    throw new Error('CLIENT_API_BASE_URL_INVALID');
  }
  if (!/^https:\/\//.test(authBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(authBaseUrl)) {
    throw new Error('CLIENT_AUTH_BASE_URL_INVALID');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(clientVersion)) throw new Error('CLIENT_VERSION_INVALID');
  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    authBaseUrl: authBaseUrl.replace(/\/$/, ''),
    clientVersion,
  } as const;
}

function required(value: string | undefined, error: string): string {
  if (!value?.trim()) throw new Error(error);
  return value.trim();
}

function buildIdentity(source: Readonly<Record<string, string | undefined>>) {
  const commit = source.SHOP_BUILD_COMMIT?.trim() || source.GITHUB_SHA?.trim() || git(['rev-parse', 'HEAD'], 'CONSOLE_BUILD_COMMIT_MISSING');
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('CONSOLE_BUILD_COMMIT_INVALID');
  const sourceTree = source.SHOP_SOURCE_TREE?.trim() || (git(['status', '--porcelain', '--untracked-files=all'], 'CONSOLE_BUILD_SOURCE_TREE_UNKNOWN') === '' ? 'clean' : 'dirty');
  if (!['clean', 'dirty'].includes(sourceTree)) throw new Error('CONSOLE_BUILD_SOURCE_TREE_INVALID');
  const branch = source.SHOP_BUILD_BRANCH?.trim() || source.GITHUB_REF_NAME?.trim() || git(['branch', '--show-current'], 'CONSOLE_BUILD_BRANCH_MISSING') || 'detached';
  const id = source.SHOP_BUILD_ID?.trim() || `${commit.slice(0, 12)}${sourceTree === 'dirty' ? '-dirty' : ''}`;
  return { commit, sourceTree, branch, id } as const;
}

function git(args: readonly string[], error: string): string {
  try {
    return execFileSync('git', args, { cwd: consoleRoot, encoding: 'utf8' }).trim();
  } catch {
    throw new Error(error);
  }
}

function consoleArtifactPlugin(artifact: Readonly<Record<string, string>>): Plugin {
  return {
    name: 'shop-console-artifact',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'console-build.json',
        source: `${JSON.stringify(artifact, null, 2)}\n`,
      });
    },
  };
}
