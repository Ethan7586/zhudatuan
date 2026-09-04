import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const index = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('console bootstrap document', () => {
  it('discovers the API before the main module executes', () => {
    expect(index).toContain('<link rel="preconnect" href="%VITE_API_BASE_URL%" crossorigin />');
    expect(index).toContain("readJson('%VITE_API_BASE_URL%/api/v1/identity/session'");
    expect(index).toContain("'x-client-version': '%VITE_CLIENT_VERSION%'");
    expect(index.indexOf('rel="preconnect"')).toBeLessThan(index.indexOf('src="/src/main.tsx"'));
  });

  it('starts the default cockpit read from the validated session context', () => {
    expect(index).toContain("location.pathname.match(/^\\/scopes\\/(platform|distributor|tenant|enterprise|mall)");
    expect(index).toContain("if (location.pathname !== '/' && direct === undefined) return undefined;");
    expect(index).toContain('readJson(`%VITE_API_BASE_URL%/api/v1/reports/dashboard?period=${period}&limit=100`');
    expect(index).toContain("'x-scope-hint': first.id");
    expect(index).toContain("'x-access-version': String(value.accessVersion)");
  });

  it('prefetches the exact direct cockpit scope and selected period on refresh', () => {
    expect(index).toContain("direct = match === null ? undefined : { kind: match[1], id: decodeURIComponent(match[2]) }");
    expect(index).toContain("['realtime', 'yesterday', '7days', '30days'].includes(requested)");
    expect(index).toContain('scopeKind: first.kind, scopeId: first.id, accessVersion: value.accessVersion, period, value: dashboard');
  });

  it('makes every document prefetch observable and immediately abortable by navigation', () => {
    expect(index).toContain('const slot = { settled: false, promise: undefined };');
    expect(index).toContain('window.__consoleAbortDocumentPrefetch = () =>');
    expect(index).toContain('controller.abort(), 1_500');
    expect(index).not.toContain('controller.abort(), 15_000');
  });

  it('starts profile and organization context reads without adding API calls', () => {
    expect(index).toContain("readJson('%VITE_API_BASE_URL%/api/v1/members/me', headers)");
    expect(index).toContain("readJson('%VITE_API_BASE_URL%/api/v1/organizations/layers?limit=1000'");
    expect(index).toContain('window.__consoleScopePrefetch = tracked(');
  });

  it('starts with the shared route loading state instead of an empty root', () => {
    expect(index).toContain('<main class="statemain" aria-label="页面加载状态">');
    expect(index).toContain('<p role="status" aria-live="polite">正在加载…</p>');
  });
});
