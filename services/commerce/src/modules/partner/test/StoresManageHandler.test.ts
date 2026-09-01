import { describe, expect, it } from 'vitest';
import { StoresManageHandler } from '../application/handler/StoresManageHandler';

describe('StoresManageHandler', () => {
  it('returns the saved version as ETag from commit and finalize', async () => {
    const saved = Object.freeze({
      id: 'store:one',
      scope: 'mall:one',
      name: '测试门店',
      status: 'active',
      version: 3,
      mall: 'mall:one',
      regionCode: '310000',
      serviceRadiusMeters: 3000,
      addressConfigured: true,
    });
    const handler = new StoresManageHandler(
      {
        storeScope: async () => null,
        saveStore: async () => saved,
      } as never,
      { descendants: async () => ['mall:one'], node: async () => ({ id: 'mall:one', kind: 'mall' }) } as never,
      {} as never
    );
    const context = {
      expectedVersion: 2,
      transaction: {},
      security: {
        kind: 'session',
        access: { scope: { id: 'mall:one', kind: 'mall', tenant: 'tenant:one', path: [] } },
      },
    } as never;

    const committed = await handler.commit({} as never, { id: saved.id, name: saved.name, status: saved.status, region: saved.regionCode, mall: saved.mall, radius: saved.serviceRadiusMeters, envelope: null }, context);
    const finalized = await handler.finalize({} as never, committed.checkpoint, {} as never);

    expect(committed.response.headers).toEqual({ etag: '"3"' });
    expect(finalized.headers).toEqual({ etag: '"3"' });
  });
});
