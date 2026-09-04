import { describe, expect, it, vi } from 'vitest';
import { CatalogReadHandler } from '../application/handler/CatalogReadHandler';

const entry = Object.freeze({
  application: 'application:one',
  handle: 'mall-one',
  mall: 'mall:one',
  pool: 'pool:one',
  release: 'release:one',
  version: 'version:one',
  tenant: 'tenant:one',
  url: 'https://shop.test/s/mall-one',
});

describe('storefront catalog scope routing', () => {
  it('routes anonymous catalog reads through the server-resolved mall', async () => {
    const handler = new CatalogReadHandler({ entry: vi.fn(), execute: vi.fn() } as never);
    const prepared = await handler.prepare({} as never, { security: { kind: 'anonymous' } } as never, entry as never);
    expect(handler.transactionScope({} as never, prepared)).toBe('mall:one');
  });

  it('retains the authenticated membership scope for catalog reads', async () => {
    const handler = new CatalogReadHandler({ entry: vi.fn(), execute: vi.fn() } as never);
    const prepared = await handler.prepare({} as never, { security: { kind: 'session' } } as never, entry as never);
    expect(handler.transactionScope({} as never, prepared)).toBeUndefined();
  });
});
