import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { UploadPort } from '../port/UploadPort';
import { UploadsCreateHandler } from './UploadsCreateHandler';

describe('UploadsCreateHandler', () => {
  it('returns the object reference separately from the public upload authorization', async () => {
    const authorize = vi.fn(async () => ({
      reference: 'object:stock',
      path: 'tenant/owner/import/2030/01/01/stock.csv',
      sha256: 'a'.repeat(64),
      size: 32,
      contentType: 'text/csv',
      retentionUntil: '2030-01-08T00:00:00.000Z',
      upload: {
        reference: 'object:stock',
        url: 'https://objects.test/upload',
        method: 'PUT' as const,
        headers: { 'x-content-sha256': 'a'.repeat(64) },
        expiresAt: '2030-01-01T00:05:00.000Z',
      },
    }));
    const handler = new UploadsCreateHandler({ authorize } as unknown as UploadPort);

    const reply = await handler.execute(
      { body: { name: '补充库存.csv', contentType: 'text/csv', size: 32, sha256: 'a'.repeat(64) } } as never,
      writeContext() as never
    );

    expect(reply.status).toBe(201);
    expect(authorize).toHaveBeenCalledWith({
      tenant: 'mall:one',
      category: 'import',
      name: '补充库存.csv',
      contentType: 'text/csv',
      size: 32,
      sha256: 'a'.repeat(64),
      retentionDays: expect.any(Number),
    });
    expect(reply.body).toMatchObject({ reference: 'object:stock', upload: { method: 'PUT' } });
    expect(reply.body.upload).not.toHaveProperty('reference');
    expect(() => OPERATION_SCHEMAS['runtime.uploads.create'].output.parse(reply.body)).not.toThrow();
  });

  it('maps invalid import metadata to the file field', async () => {
    const handler = new UploadsCreateHandler({ authorize: vi.fn(async () => Promise.reject(new Error('UPLOAD_SESSION_INVALID'))) } as unknown as UploadPort);

    await expect(
      handler.execute({ body: { name: '补充库存.csv', contentType: 'text/csv', size: 32, sha256: 'a'.repeat(64) } } as never, writeContext() as never)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field: 'file' } });
  });
});

function writeContext() {
  return { ...readHandlerContext('runtime.uploads.create', {} as never), idempotencyKey: 'runtime-upload:one' };
}
