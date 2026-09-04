import { describe, expect, it, vi } from 'vitest';
import { StoresManageHandler } from '../application/handler/StoresManageHandler';

describe('StoresManageHandler', () => {
  it('preserves encrypted address data when the command omits address', async () => {
    const saveStore = vi.fn(async (input) => ({
      id: input.id,
      scope: input.scope,
      name: input.name,
      status: input.status,
      version: 3,
      mall: input.mall,
      regionCode: input.region,
      serviceRadiusMeters: input.radius,
      addressConfigured: true,
    }));
    const encrypt = vi.fn();
    const handler = new StoresManageHandler({ storeScope: async () => 'mall:one', saveStore } as never, { descendants: async () => ['mall:one'], node: async () => ({ id: 'mall:one', kind: 'mall' }) } as never, { encrypt } as never);
    const input = { path: { storeid: 'store:one' }, body: { name: '测试门店', status: 'active', regionCode: 'CN-31', mall: 'mall:one', serviceRadiusMeters: 3000 } } as never;
    const prepared = await handler.prepare(input, context as never);
    await handler.commit(input, prepared, context as never);
    expect(encrypt).not.toHaveBeenCalled();
    expect(saveStore).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ addressChanged: false, ciphertext: undefined, token: undefined, keyVersion: undefined }));
  });

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
    const committed = await handler.commit({} as never, { id: saved.id, name: saved.name, status: saved.status, region: saved.regionCode, mall: saved.mall, radius: saved.serviceRadiusMeters, envelope: null }, context as never);
    const finalized = await handler.finalize({} as never, committed.checkpoint, {} as never);

    expect(committed.response.headers).toEqual({ etag: '"3"' });
    expect(finalized.headers).toEqual({ etag: '"3"' });
  });
});

const context = {
  expectedVersion: 2,
  transaction: {},
  security: {
    kind: 'session',
    access: { actor: { id: 'actor:one' }, membership: { id: 'membership:one' }, scope: { id: 'mall:one', kind: 'mall', tenant: 'tenant:one', path: [] } },
  },
};
