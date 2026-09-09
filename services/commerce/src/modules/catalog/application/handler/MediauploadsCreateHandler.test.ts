import { describe, expect, it, vi } from 'vitest';
import type { AssetPort } from '../../../runtime/public';
import { OPERATION_SCHEMAS } from '@shop/contract';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import { MediauploadsCreateHandler } from './MediauploadsCreateHandler';

describe('MediauploadsCreateHandler', () => {
  it('creates a tenant-scoped image upload session from validated metadata', async () => {
    const authorize = vi.fn(async () => ({
      reference: 'object:cover',
      path: 'tenant/owner/asset/2030/01/01/image.png',
      sha256: 'a'.repeat(64),
      size: 8,
      contentType: 'image/png' as const,
      retentionUntil: '2030-12-31T00:00:00.000Z',
      upload: { reference: 'object:cover', url: 'https://objects.test/upload', method: 'PUT' as const, headers: {}, expiresAt: '2030-01-01T00:05:00.000Z' },
    }));
    const handler = new MediauploadsCreateHandler({ authorize } as unknown as AssetPort);

    const reply = await handler.execute({ body: { name: '商品.png', contentType: 'image/png', size: 8, sha256: 'a'.repeat(64) } } as never, writeContext() as never);

    expect(reply.status).toBe(201);
    expect(authorize).toHaveBeenCalledWith({ tenant: 'mall:one', name: '商品.png', contentType: 'image/png', size: 8, sha256: 'a'.repeat(64) });
    expect(reply.body).toMatchObject({ reference: 'object:cover', upload: { method: 'PUT' } });
    expect(reply.body.upload).not.toHaveProperty('reference');
    expect(() => OPERATION_SCHEMAS['catalog.mediauploads.create'].output.parse(reply.body)).not.toThrow();
  });

  it('maps an invalid upload request to the image field', async () => {
    const handler = new MediauploadsCreateHandler({ authorize: vi.fn(async () => Promise.reject(new Error('UPLOAD_SESSION_INVALID'))) } as unknown as AssetPort);
    await expect(handler.execute({ body: { name: '商品.png', contentType: 'image/png', size: 8, sha256: 'a'.repeat(64) } } as never, writeContext() as never)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { field: 'image' },
    });
  });
});

function writeContext() {
  return { ...readHandlerContext('catalog.mediauploads.create', {} as never), idempotencyKey: 'catalog-media:one' };
}
