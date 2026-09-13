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
    };

    startDocumentPrefetch(config);

    await expect(window.__consoleSessionPrefetch?.promise).resolves.toEqual({ value: earlyValue });
    expect(abort).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.hbbtzn.com/api/v1/identity/session',
      expect.objectContaining({ credentials: 'include', redirect: 'error' }),
    );
  });
});
