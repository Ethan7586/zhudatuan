// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { startDocumentPrefetch } from './DocumentPrefetch';

const config = { apiBaseUrl: 'https://api.hbbtzn.com', clientVersion: '0.0.0-gexact' } as const;
const earlyValue = { accessVersion: 3, capabilities: [], permissions: [], scopes: [] };

afterEach(() => {
  window.__consoleAbortDocumentPrefetch?.();
  for (const key of Object.keys(window).filter((key) => key.startsWith('__console'))) {
    delete (window as unknown as Record<string, unknown>)[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('early session prefetch handoff', () => {
  it('reuses the HTML-started session request for the exact API and client version', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    window.__consoleEarlySessionPrefetch = {
      apiBaseUrl: config.apiBaseUrl,
      clientVersion: config.clientVersion,
      settled: true,
      abort: vi.fn(),
      promise: Promise.resolve(earlyValue),
    };

    startDocumentPrefetch(config);

    await expect(window.__consoleSessionPrefetch?.promise).resolves.toEqual({ value: earlyValue });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reuses the HTML-started scope and permission work without duplicate profile reads', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const root = { kind: 'mall', id: 'mall:early' } as const;
    const scopeValue = {
      accessVersion: config.clientVersion.length,
      roots: [root],
      profile: { display_name: 'Ethan', employee_no: null },
      layers: [],
    };
    window.__consoleEarlySessionPrefetch = {
      apiBaseUrl: config.apiBaseUrl,
      clientVersion: config.clientVersion,
      settled: true,
      abort: vi.fn(),
      promise: Promise.resolve({
        ...earlyValue,
        accessVersion: scopeValue.accessVersion,
        scope: root,
        scopes: [root],
        profile: scopeValue.profile,
      }),
      scope: { settled: true, promise: Promise.resolve(scopeValue) },
    };

    startDocumentPrefetch(config);

    await expect(window.__consoleScopePrefetch?.promise).resolves.toEqual(scopeValue);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/v1/members/me'))).toBe(false);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/v1/organizations/layers'))).toBe(false);
  });

  it('rejects a session from another API origin and starts the authoritative request', async () => {
    const abort = vi.fn();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(earlyValue), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    window.__consoleEarlySessionPrefetch = {
      apiBaseUrl: 'https://wrong.example.com',
      clientVersion: config.clientVersion,
      settled: false,
      abort,
      promise: new Promise(() => undefined),
      scope: {
        settled: true,
        promise: Promise.resolve({ accessVersion: 999, roots: [], profile: undefined, layers: [] }),
      },
    };

    startDocumentPrefetch(config);

    await expect(window.__consoleSessionPrefetch?.promise).resolves.toEqual({ value: earlyValue });
    await expect(window.__consoleScopePrefetch?.promise).resolves.toBeUndefined();
    expect(abort).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.hbbtzn.com/api/v1/identity/session',
      expect.objectContaining({ credentials: 'include', redirect: 'error' }),
    );
  });
});
