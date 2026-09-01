import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationRequest';
import type { ObjectUpload } from '../../../../foundation/infrastructure/ObjectStore';
import { AfterSaleAttachmentService } from './AfterSaleAttachmentService';

const membership = 'membership:one';
const owner = createHash('sha256').update(membership).digest('hex').slice(0, 32);
const reference = `object:aftersale/${owner}/damage.png`;
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const pngHash = createHash('sha256').update(png).digest('hex');

describe('AfterSaleAttachmentService', () => {
  it('uploads verified bytes into the member-scoped private path', async () => {
    const create = vi.fn(async () => upload(png));
    await expect(new AfterSaleAttachmentService({ create }).verify(request([{ data: Buffer.from(png).toString('base64'), contentType: 'image/png', name: 'damage.png' }]).input, membership)).resolves.toEqual([
      { objectId: reference, name: 'damage.png', mediaType: 'image/png', sizeBytes: png.byteLength, contentHash: pngHash },
    ]);
    expect(create).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^aftersale/${owner}/[0-9a-f-]+\\.png$`)), 'image/png');
  });

  it('rejects spoofed MIME, invalid base64 and failed integrity checks', async () => {
    const create = vi.fn(async () => upload(png));
    await expect(new AfterSaleAttachmentService({ create }).verify(request([{ data: Buffer.from('javascript').toString('base64'), contentType: 'image/png', name: 'damage.png' }]).input, membership)).rejects.toThrow('VALIDATION_FAILED');
    await expect(new AfterSaleAttachmentService({ create }).verify(request([{ data: '***', contentType: 'image/png', name: 'damage.png' }]).input, membership)).rejects.toThrow('VALIDATION_FAILED');
    await expect(
      new AfterSaleAttachmentService({ create: vi.fn(async () => upload(png, 'b'.repeat(64))) }).verify(request([{ data: Buffer.from(png).toString('base64'), contentType: 'image/png', name: 'damage.png' }]).input, membership)
    ).rejects.toThrow('VALIDATION_FAILED');
  });
});

function upload(bytes: Uint8Array, sha256 = pngHash): ObjectUpload {
  return {
    append: vi.fn(async () => undefined),
    complete: vi.fn(async () => ({ reference, sha256, size: bytes.byteLength, scan: 'clean' as const })),
    abort: vi.fn(async () => undefined),
  };
}

function request(attachments: readonly unknown[]): OperationRequest {
  return {
    type: 'order.aftersales.apply',
    input: { path: { orderid: 'order:one' }, query: {}, headers: {}, body: { attachments }, rawBody: '', deadline: Date.now() + 1000, signal: new AbortController().signal },
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership, credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
        membership: { id: membership, active: true, accessVersion: 1, permissions: { allows: new Set(['order.aftersales.apply']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'owner', path: [] },
        accessVersion: 1,
        capabilities: new Set(['order.aftersales.apply']),
        capabilityVersion: 1,
        assurance: { level: 2 },
        trace: 'trace:one',
      },
    },
  };
}
