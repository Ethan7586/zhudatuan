import { createHash } from 'node:crypto';
import { IMPORT_CAPACITY, RUNTIME_LIMITS } from '@shop/config/runtime';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectMetadata, ObjectStore, UploadAuthorization } from '../../public/ObjectPort';
import type { UploadRecord, UploadRequest } from '../../application/port/UploadPort';
import { UploadSession } from './UploadSession';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha256 = createHash('sha256').update(png).digest('hex');
const now = new Date('2030-01-02T03:04:05.000Z');

describe('UploadSession', () => {
  it('issues a tenant-scoped grant with an immutable checksum, size, type and retention receipt', async () => {
    const authorizeUpload = vi.fn(
      async (input): Promise<UploadAuthorization> => ({
        reference: 'object:upload',
        url: 'https://objects.test/upload',
        method: 'PUT',
        headers: { 'content-type': input.contentType, 'content-length': String(input.size), 'x-content-sha256': input.sha256, 'x-retention-until': String(input.retentionUntil) },
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      })
    );
    const session = new UploadSession({ authorizeUpload } as unknown as ObjectStore);

    const record = await session.authorize(request(), now);

    const owner = createHash('sha256').update('tenant:one').digest('hex').slice(0, 32);
    expect(record).toMatchObject({ reference: 'object:upload', sha256, size: png.byteLength, contentType: 'image/png', retentionUntil: '2030-01-09T03:04:05.000Z' });
    expect(record.path).toMatch(new RegExp(`^tenant/${owner}/attachment/2030/01/02/[a-f0-9-]+\\.png$`, 'u'));
    expect(authorizeUpload).toHaveBeenCalledWith({ path: record.path, contentType: 'image/png', size: png.byteLength, sha256, expiresIn: RUNTIME_LIMITS.upload.authorizationSeconds, retentionUntil: record.retentionUntil });
  });

  it('streams the completed object once and verifies metadata, retention, magic, size and content hash', async () => {
    const record = uploadRecord();
    const inspect = vi.fn(async () => metadata(record));
    const chunks = vi.fn(async function* () {
      yield png.slice(0, 3);
      yield png.slice(3);
    });
    const session = new UploadSession({ inspect, chunks } as unknown as ObjectStore);

    await expect(session.verify(record)).resolves.toEqual(metadata(record));
    expect(chunks).toHaveBeenCalledExactlyOnceWith(record.reference, record.size);
  });

  it.each([
    ['path', { path: 'tenant/other/attachment/file.png' }],
    ['hash', { sha256: 'b'.repeat(64) }],
    ['size', { size: png.byteLength + 1 }],
    ['type', { contentType: 'application/pdf' }],
    ['retention', { retentionUntil: '2030-01-10T03:04:05.000Z' }],
  ])('rejects a changed %s receipt before accepting the object', async (_field, changed) => {
    const record = uploadRecord();
    const session = new UploadSession({ inspect: vi.fn(async () => metadata(record, changed)), chunks: vi.fn() } as unknown as ObjectStore);
    await expect(session.verify(record)).rejects.toThrow('UPLOAD_OBJECT_INVALID');
  });

  it('rejects malware, pending scans, content tampering and forged file signatures', async () => {
    const record = uploadRecord();
    for (const scan of ['infected', 'pending']) {
      const session = new UploadSession({ inspect: vi.fn(async () => ({ ...metadata(record), scan })), chunks: vi.fn() } as unknown as ObjectStore);
      await expect(session.verify(record)).rejects.toThrow('UPLOAD_OBJECT_INVALID');
    }
    const tampered = png.map((value, index) => (index === png.length - 1 ? value + 1 : value));
    await expect(new UploadSession(store(record, metadata(record), tampered)).verify(record)).rejects.toThrow('UPLOAD_OBJECT_INVALID');
    const renamed = new TextEncoder().encode('not a png');
    const forged = { ...record, size: renamed.byteLength, sha256: createHash('sha256').update(renamed).digest('hex') };
    await expect(new UploadSession(store(forged, metadata(forged), renamed)).verify(forged)).rejects.toThrow('UPLOAD_CONTENT_MISMATCH');
  });

  it('enforces type-specific sizes, extensions, retention and clock validity before remote work', async () => {
    const authorizeUpload = vi.fn();
    const session = new UploadSession({ authorizeUpload } as unknown as ObjectStore);
    const invalid = [
      { ...request(), category: 'import' as const, name: 'large.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: IMPORT_CAPACITY.maximumSpreadsheetBytes + 1 },
      { ...request(), name: 'receipt.pdf' },
      { ...request(), retentionDays: RUNTIME_LIMITS.upload.maximumRetentionDays + 1 },
    ];
    for (const input of invalid) await expect(session.authorize(input, now)).rejects.toThrow('UPLOAD_SESSION_INVALID');
    await expect(session.authorize(request(), new Date(Number.NaN))).rejects.toThrow('UPLOAD_SESSION_INVALID');
    expect(authorizeUpload).not.toHaveBeenCalled();
  });
});

function request(overrides: Partial<UploadRequest> = {}): UploadRequest {
  return { tenant: 'tenant:one', category: 'attachment', name: 'receipt.png', contentType: 'image/png', size: png.byteLength, sha256, retentionDays: 7, ...overrides };
}

function uploadRecord(): Omit<UploadRecord, 'upload'> {
  return { reference: 'object:upload', path: 'tenant/owner/attachment/2030/01/02/id.png', sha256, size: png.byteLength, contentType: 'image/png', retentionUntil: '2030-01-09T03:04:05.000Z' };
}

function metadata(record: Omit<UploadRecord, 'upload'>, overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return { reference: record.reference, path: record.path, sha256: record.sha256, size: record.size, scan: 'clean', contentType: record.contentType, retentionUntil: record.retentionUntil, lockedUntil: null, ...overrides };
}

function store(record: Omit<UploadRecord, 'upload'>, value: ObjectMetadata, bytes: Uint8Array): ObjectStore {
  return {
    inspect: vi.fn(async () => value),
    chunks: vi.fn(async function* () {
      yield bytes;
    }),
  } as unknown as ObjectStore;
}
