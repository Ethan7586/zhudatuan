// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { BootstrapGateway } from '../../src/feature/bootstrap/infrastructure/BootstrapGateway';
import { bootstrapOutput, environment, identitySdk } from '../TestData';

describe('BootstrapGateway', () => {
  it('singleflights equal requests, caches only to the server expiry and supports consumer cancellation', async () => {
    let release: ((value: ReturnType<typeof bootstrapOutput>) => void) | undefined;
    const read = vi.fn<IdentitySdk['bootstrapRead']>(() => new Promise<ReturnType<typeof bootstrapOutput>>((resolve) => { release = resolve; }));
    const gateway = new BootstrapGateway(identitySdk({ bootstrapRead: read }), environment);
    const session = Object.freeze({ target: 'storefront' as const, returnPath: '/orders' });
    const first = gateway.read(session);
    const controller = new AbortController();
    const cancelled = gateway.read(session, controller.signal);
    controller.abort();
    release?.(bootstrapOutput());
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    await expect(first).resolves.toMatchObject({ target: 'storefront' });
    await gateway.read(session);
    expect(read).toHaveBeenCalledOnce();
    gateway.clear('storefront');
    void gateway.read(session);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
