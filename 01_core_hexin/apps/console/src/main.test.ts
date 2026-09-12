import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const index = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const main = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
const prefetch = readFileSync(resolve(process.cwd(), 'src/shared/api/DocumentPrefetch.ts'), 'utf8');
const runtime = readFileSync(resolve(process.cwd(), 'src/shared/config/RuntimeConfig.ts'), 'utf8');

describe('console bootstrap document', () => {
  it('loads the Host-bound NodeManifest before API prefetch or application modules', () => {
    expect(index).not.toContain('%VITE_API_BASE_URL%');
    expect(index).not.toContain('%VITE_CLIENT_VERSION%');
    expect(runtime).toContain("fetch('/console-runtime.json'");
    expect(runtime).toContain("fetch('/console-build.json'");
    expect(runtime.indexOf("fetch('/console-runtime.json'")).toBeLessThan(runtime.indexOf("fetch('/console-build.json'"));
    expect(prefetch).toContain('fetch(`${appConfig.apiBaseUrl}${path}`');
    expect(prefetch).toContain("'x-client-version': appConfig.clientVersion");
    expect(main.indexOf('loadConsoleRuntimeConfig()')).toBeLessThan(main.indexOf("import('./app/providers')"));
  });

  it('starts the default cockpit read from the validated session context', () => {
    expect(prefetch).toContain("location.pathname.match(/^\\/scopes\\/(platform|distributor|tenant|enterprise|mall)");
    expect(prefetch).toContain("if (location.pathname !== '/' && direct === undefined) return undefined;");
    expect(prefetch).toContain('readJson<unknown>(`/api/v1/reports/dashboard?period=${period}&limit=100`');
    expect(prefetch).toContain("'x-scope-hint': first.id");
    expect(prefetch).toContain("'x-access-version': String(value.accessVersion)");
  });

  it('prefetches the exact direct cockpit scope and selected period on refresh', () => {
    expect(prefetch).toContain("direct = match === null ? undefined : { kind: match[1]!, id: decodeURIComponent(match[2]!) }");
    expect(prefetch).toContain("['realtime', 'yesterday', '7days', '30days'].includes(requested)");
    expect(prefetch).toContain('scopeKind: first.kind');
  });

  it('makes every document prefetch observable and immediately abortable by navigation', () => {
    expect(prefetch).toContain('const slot: Tracked<T> = { settled: false');
    expect(prefetch).toContain('window.__consoleAbortDocumentPrefetch = () =>');
    expect(prefetch).toContain('controller.abort(), 1_500');
    expect(prefetch).not.toContain('controller.abort(), 15_000');
  });

  it('starts profile and organization context reads without adding API calls', () => {
    expect(prefetch).toContain("readJson<unknown>('/api/v1/members/me', headers)");
    expect(prefetch).toContain("readJson<unknown>('/api/v1/organizations/layers?limit=1000'");
    expect(prefetch).toContain('window.__consoleScopePrefetch = tracked(');
  });

  it('starts with the shared route loading state instead of an empty root', () => {
    expect(index).toContain('<main class="statemain" aria-label="页面加载状态">');
    expect(index).toContain('<p role="status" aria-live="polite">正在加载…</p>');
  });

  it('recovers once when an open page references retired dynamic modules', () => {
    expect(main).toContain('recoverFromDynamicImportFailure(cause)');
    expect(main).toContain('clearDynamicImportRecoveryAfterStableBoot()');
  });
});
