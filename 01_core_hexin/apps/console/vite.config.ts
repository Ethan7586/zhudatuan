import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import {
  materializeSflConsoleArtifact,
  normalizeConsoleClientVersion,
} from '@shop/config/sfl-console-runtime';
import { SFL_CONSOLE_RELEASE_DECLARATION } from '@shop/config/sfl-node-registry';
import { consoleImmutableArtifactDigest } from '../../../04_tools/scripts/release/console-digest.mjs';
import { createConsoleVersion } from './src/shared/config/ConsoleDeployment';

export default defineConfig(({ command, mode }) => {
  const environment = { ...loadEnv(mode, import.meta.dirname, ''), ...process.env };
  if (command === 'build') validateClientBuildEnvironment(environment);
  const build = buildDefinition(environment);
  const clientVersion = normalizeConsoleClientVersion(environment.VITE_CLIENT_VERSION);
  return {
    plugins: [consoleBootPrefetch(environment.VITE_API_BASE_URL, clientVersion), react(), tailwindcss(), consoleRuntimeEvidence(build, clientVersion)],
    define: {
      __SHOP_BUILD_COMMIT__: JSON.stringify(build.commit),
      __SHOP_BUILD_BRANCH__: JSON.stringify(build.branch),
      __SHOP_BUILD_ID__: JSON.stringify(build.id),
      __SHOP_BUILD_DIRTY__: JSON.stringify(build.dirty),
      __SHOP_BUILD_AT__: JSON.stringify(build.builtAt),
    },
    build: { manifest: true },
    server: {
      port: 5173,
      /**
       * Production serves node-specific API origins from the SFL runtime binding.
       * Development keeps API calls same-origin and proxies them to the local service.
       */
      proxy: {
        '/api': {
          target: process.env.COMMERCE_API_ORIGIN ?? 'http://127.0.0.1:3001',
          changeOrigin: false,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

function consoleBootPrefetch(apiBaseUrl: string | undefined, clientVersion: string): Plugin {
  const normalizedApiBaseUrl = apiBaseUrl?.trim().replace(/\/$/, '');
  return {
    name: 'console-boot-prefetch',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (normalizedApiBaseUrl === undefined || normalizedApiBaseUrl === '') return html;
        const apiOrigin = new URL(normalizedApiBaseUrl).origin;
        const charset = '<meta charset="UTF-8" />';
        const hints = `${charset}\n    <link rel="preconnect" href="${apiOrigin}" crossorigin />\n    <script>${earlyBootScript(normalizedApiBaseUrl, clientVersion)}</script>`;
        return html.replace(charset, hints);
      },
    },
  };
}

function earlyBootScript(apiBaseUrl: string, clientVersion: string): string {
  return `(()=>{const api=${scriptValue(apiBaseUrl)},version=${scriptValue(clientVersion)},request=(path)=>fetch(path,{cache:'no-store',credentials:'same-origin',headers:{accept:'application/json'},redirect:'error'});window.__consoleEarlyRuntimePrefetch={node:request('/console-runtime.json'),fallback:request('/console-build.json')};void window.__consoleEarlyRuntimePrefetch.node.catch(()=>undefined);void window.__consoleEarlyRuntimePrefetch.fallback.catch(()=>undefined);const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),1500),slot={apiBaseUrl:api,clientVersion:version,settled:false,abort:()=>controller.abort(),promise:Promise.resolve(undefined)};slot.promise=fetch(api+'/api/v1/identity/session',{credentials:'include',redirect:'error',signal:controller.signal,headers:{accept:'application/json','x-contract-version':'1.0.0','x-client-version':version,'x-trace-id':crypto.randomUUID()}}).then(async(response)=>{if(!response.ok)return undefined;try{return await response.json()}catch{return undefined}},()=>undefined).finally(()=>{window.clearTimeout(timeout);slot.settled=true});window.__consoleEarlySessionPrefetch=slot})();`;
}

function scriptValue(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

const repositoryRoot = resolve(import.meta.dirname, '../../..');

interface BuildDefinition {
  readonly commit: string;
  readonly branch: string;
  readonly id: string;
  readonly dirty: boolean;
  readonly builtAt: string;
}

function consoleRuntimeEvidence(build: BuildDefinition, clientVersion: string): Plugin {
  let outputDirectory = resolve(import.meta.dirname, 'dist');
  return {
    name: 'sfl-console-runtime-evidence',
    configResolved(config) {
      outputDirectory = isAbsolute(config.build.outDir)
        ? config.build.outDir
        : resolve(import.meta.dirname, config.build.outDir);
    },
    async closeBundle() {
      const version = createConsoleVersion({
        sourceBranch: build.branch,
        sourceSha: build.commit,
        builtAt: build.builtAt,
        sourceTree: build.dirty ? 'dirty' : 'clean',
        buildId: build.id,
      });
      writeFileSync(
        join(outputDirectory, 'console-version.json'),
        `${JSON.stringify(version, null, 2)}\n`,
      );
      const immutableArtifactDigest = consoleImmutableArtifactDigest(outputDirectory);
      const artifact = await materializeSflConsoleArtifact(SFL_CONSOLE_RELEASE_DECLARATION, {
        source_sha: build.commit,
        build_id: build.id,
        source_tree: build.dirty ? 'dirty' : 'clean',
        client_version: clientVersion,
        immutable_artifact_digest: immutableArtifactDigest,
      });
      writeFileSync(
        join(outputDirectory, 'console-build.json'),
        `${JSON.stringify(artifact, null, 2)}\n`,
      );
    },
  };
}

function buildDefinition(environment: Readonly<Record<string, string | undefined>>): BuildDefinition {
  const commit = environment.SHOP_BUILD_COMMIT?.trim() || git(['rev-parse', 'HEAD']);
  const branch = environment.SHOP_BUILD_BRANCH?.trim() || git(['branch', '--show-current']) || 'detached';
  const dirty = environment.SHOP_BUILD_DIRTY === undefined
    ? git(['status', '--porcelain', '--untracked-files=no']).length > 0
    : environment.SHOP_BUILD_DIRTY === 'true';
  const id = environment.SHOP_BUILD_ID?.trim() || `${commit.slice(0, 12)}${dirty ? '-dirty' : ''}`;
  const builtAt = environment.SHOP_BUILD_AT?.trim() || new Date().toISOString();
  return Object.freeze({ commit, branch, id, dirty, builtAt });
}

function git(arguments_: readonly string[]): string {
  return execFileSync('git', ['-C', repositoryRoot, ...arguments_], { encoding: 'utf8' }).trim();
}

function validateClientBuildEnvironment(source: Readonly<Record<string, string | undefined>>): void {
  const apiBaseUrl = requiredBuildValue(source.VITE_API_BASE_URL, 'CLIENT_API_BASE_URL_MISSING');
  const authBaseUrl = requiredBuildValue(source.VITE_AUTH_BASE_URL, 'CLIENT_AUTH_BASE_URL_MISSING');
  const clientVersion = requiredBuildValue(source.VITE_CLIENT_VERSION, 'CLIENT_VERSION_MISSING');
  if (!/^https:\/\//.test(apiBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(apiBaseUrl)) {
    throw new Error('CLIENT_API_BASE_URL_INVALID');
  }
  if (!/^https:\/\//.test(authBaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(authBaseUrl)) {
    throw new Error('CLIENT_AUTH_BASE_URL_INVALID');
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(clientVersion)) throw new Error('CLIENT_VERSION_INVALID');
}

function requiredBuildValue(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
