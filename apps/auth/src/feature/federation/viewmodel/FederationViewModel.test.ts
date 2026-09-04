import { describe, expect, it, vi } from 'vitest';
import type { ReadProviders } from '../application/ReadProviders';
import type { StartFederation } from '../application/StartFederation';
import { FederationViewModel } from './FederationViewModel';

describe('FederationViewModel', () => {
  it('delegates reads and starts without changing the trusted return target', async () => {
    const read = vi.fn().mockResolvedValue([]);
    const start = vi.fn().mockResolvedValue({ redirectUrl: 'https://identity.example/callback' });
    const viewmodel = new FederationViewModel({ execute: read } as unknown as ReadProviders, { execute: start } as unknown as StartFederation);
    const signal = new AbortController().signal;
    const session = Object.freeze({ target: 'console' as const, returnTarget: 'signed-return' });
    await expect(viewmodel.read(session, signal)).resolves.toEqual([]);
    await expect(viewmodel.start('wecom', session, signal)).resolves.toEqual({ redirectUrl: 'https://identity.example/callback' });
    expect(start).toHaveBeenCalledWith('wecom', session, signal);
  });
});
