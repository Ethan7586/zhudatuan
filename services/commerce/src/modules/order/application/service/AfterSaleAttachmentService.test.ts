import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import type { ObjectMetadata, UploadAuthorization } from '../../../../foundation/infrastructure/ObjectStore';
import { AfterSaleAttachmentService } from './AfterSaleAttachmentService';

const membership = 'membership:one';
const owner = createHash('sha256').update(membership).digest('hex').slice(0, 32);
const reference = `object:aftersale/${owner}/damage.png`;
const sha256 = 'a'.repeat(64);

describe('AfterSaleAttachmentService', () => {
  it('authorizes direct upload under the member-scoped private path', async () => {
    const authorizeUpload = vi.fn(async (input): Promise<UploadAuthorization> => ({ reference, url: 'https://object.test/upload', method: 'PUT', headers: { 'x-checksum': input.sha256 }, expiresAt: '2033-01-01T00:00:00.000Z' }));
    const service = new AfterSaleAttachmentService({ authorizeUpload, inspect: vi.fn() });
    await expect(service.authorize(request({ name: 'damage.png', contentType: 'image/png', sizeBytes: 100, sha256 }).input, membership)).resolves.toMatchObject({ objectId: reference });
    expect(authorizeUpload).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringMatching(new RegExp(`^aftersale/${owner}/[0-9a-f-]+\\.png$`)), contentType: 'image/png', size: 100, sha256, expiresIn: 300 }));
  });

  it('accepts only a clean uploaded object with matching owner and checksum receipt', async () => {
    const inspect = vi.fn(async (): Promise<ObjectMetadata> => metadata());
    const service = new AfterSaleAttachmentService({ authorizeUpload: vi.fn(), inspect });
    await expect(service.verify(request({ attachments: [{ objectId: reference, name: 'damage.png', contentType: 'image/png', sizeBytes: 100, sha256 }] }).input, membership)).resolves.toEqual([
      { objectId: reference, name: 'damage.png', mediaType: 'image/png', sizeBytes: 100, contentHash: sha256 },
    ]);
    await expect(new AfterSaleAttachmentService({ authorizeUpload: vi.fn(), inspect: vi.fn(async () => metadata({ sha256: 'b'.repeat(64) })) }).verify(request({ attachments: [{ objectId: reference, name: 'damage.png', contentType: 'image/png', sizeBytes: 100, sha256 }] }).input, membership)).rejects.toThrow('VALIDATION_FAILED');
  });
});

function metadata(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return { reference, sha256, size: 100, scan: 'clean', contentType: 'image/png', path: `aftersale/${owner}/damage.png`, ...overrides };
}

function request(body: Record<string, unknown>): OperationRequest {
  return {
    type: 'order.aftersales.apply',
    input: { path: { orderid: 'order:one' }, query: {}, headers: {}, body, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal },
    security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:one' },
  };
}
