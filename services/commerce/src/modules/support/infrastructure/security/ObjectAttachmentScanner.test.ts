import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import type { PendingEvidence } from '../../application/port/SupportJobRepository';
import { ObjectAttachmentScanner } from './ObjectAttachmentScanner';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

describe('ObjectAttachmentScanner', () => {
  it('accepts only an uploaded object whose scan, hash, size, type, magic and name agree', async () => {
    const item = evidence(png, 'image/png');
    const scanner = new ObjectAttachmentScanner(store(item, png));

    await expect(scanner.scan(item)).resolves.toEqual({ clean: true, reason: null, recovery: null });
  });

  it.each([
    ['forged MIME', Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), 'image/png', 'receipt.png', 'TYPE_INVALID'],
    ['forged size', png, 'image/png', 'receipt.png', 'SIZE_INVALID'],
    ['unsafe filename', png, 'image/png', '../receipt.png', 'NAME_INVALID'],
  ])('rejects %s without making evidence usable', async (kind, bytes, contentType, originalName, reason) => {
    const item = evidence(bytes, contentType, originalName);
    const object = store(item, bytes);
    if (kind === 'forged size') object.inspect = vi.fn(async () => ({ ...metadata(item), size: item.size + 1 }));

    const result = await new ObjectAttachmentScanner(object).scan(item);
    expect(result).toMatchObject({ clean: false, reason });
    expect(result.recovery).toMatch(/重新上传|重命名/);
  });

  it('gives a direct Chinese recovery action for a virus rejection', async () => {
    const item = evidence(png, 'image/png');
    const object = store(item, png);
    object.inspect = vi.fn(async () => ({ ...metadata(item), scan: 'infected' })) as never;
    const result = await new ObjectAttachmentScanner(object).scan(item);
    expect(result).toEqual({ clean: false, reason: 'VIRUS_DETECTED', recovery: '附件未通过病毒检测。请删除该文件，使用可信来源的无病毒文件后重新上传。' });
  });

  it('retries a missing upload before expiry and rejects it permanently after expiry', async () => {
    const unavailable = {
      inspect: vi.fn(async () => {
        throw new Error('OBJECT_STORE_UNAVAILABLE');
      }),
      read: vi.fn(async () => {
        throw new Error('OBJECT_STORE_UNAVAILABLE');
      }),
    } as unknown as ObjectStore;
    const scanner = new ObjectAttachmentScanner(unavailable);
    await expect(scanner.scan(evidence(png, 'image/png'))).rejects.toThrow('OBJECT_STORE_UNAVAILABLE');
    await expect(scanner.scan({ ...evidence(png, 'image/png'), uploadExpiresAt: '2020-01-01T00:00:00.000Z' })).resolves.toMatchObject({ clean: false, reason: 'UPLOAD_MISSING', recovery: expect.stringContaining('重新上传') });
  });
});

function evidence(bytes: Uint8Array, contentType: string, originalName = 'receipt.png'): PendingEvidence {
  return Object.freeze({
    id: 'evidence:one',
    objectReference: 'object:support/one',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.byteLength,
    contentType,
    originalName,
    uploadExpiresAt: '2099-01-01T00:00:00.000Z',
    scope: 'mall:one',
    ticket: 'ticket:one',
    conversation: 'conversation:one',
  });
}

function metadata(item: PendingEvidence) {
  return { reference: item.objectReference, sha256: item.sha256, size: item.size, scan: 'clean' as const, contentType: item.contentType, path: 'support/evidence/one', retentionUntil: '2099-01-01T00:00:00.000Z', lockedUntil: null };
}

function store(item: PendingEvidence, bytes: Uint8Array): ObjectStore {
  return { inspect: vi.fn(async () => metadata(item)), read: vi.fn(async () => bytes) } as unknown as ObjectStore;
}
