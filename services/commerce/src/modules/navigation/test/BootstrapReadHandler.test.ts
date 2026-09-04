import { describe, expect, it, vi } from 'vitest';
import { BootstrapReadHandler } from '../application/handler/BootstrapReadHandler';

describe('BootstrapReadHandler', () => {
  it('resolves the public mall before opening the read transaction and reuses that immutable entry', async () => {
    const entry = Object.freeze({ application: 'application:one', handle: 'mall-one', url: 'https://shop.test/s/mall-one', mall: 'mall:one', pool: 'pool:one', release: 'release:one', version: 'version:one', tenant: 'tenant:one', contentHash: 'a'.repeat(64), objectKey: 'experience/application:one/a.json' });
    const execute = vi.fn(async () => ({ status: 200, body: { state: 'complete' }, headers: { 'cache-control': 'private,no-store' } }));
    const handler = new BootstrapReadHandler({ entry: vi.fn(async () => entry), execute } as never);
    const context = { security: { kind: 'anonymous' }, signal: new AbortController().signal } as never;
    const loaded = await handler.load({} as never, context);
    const prepared = await handler.prepare({} as never, context, loaded);
    expect(handler.transactionScope({} as never, prepared)).toBe('mall:one');
    const committed = await handler.commit({} as never, prepared, context);
    expect(execute).toHaveBeenCalledWith({}, context, entry);
    await expect(handler.finalize({} as never, committed.checkpoint, {} as never)).resolves.toBe(committed.response);
  });

  it('keeps an authenticated transaction bound to the authoritative session scope', async () => {
    const handler = new BootstrapReadHandler({} as never);
    const prepared = await handler.prepare({} as never, { security: { kind: 'session' } } as never, { mall: 'mall:one' } as never);
    expect(handler.transactionScope({} as never, prepared)).toBeUndefined();
  });
});
