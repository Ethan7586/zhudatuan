import { describe, expect, it, vi } from 'vitest';
import { HttpObjectStore } from './ObjectStore';

describe('HttpObjectStore', () => {
  it('requests and verifies a non-shortenable object lock', async () => {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({ mode: 'compliance', lockedUntil: until }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const store = new HttpObjectStore('https://objects.internal', 'b'.repeat(43), fetcher);
    await expect(store.lock('object:audit-evidence', until)).resolves.toEqual({ mode: 'compliance', lockedUntil: until });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ reference: 'object:audit-evidence', mode: 'compliance', until });
  });

  it('rejects a store response that shortens the requested retention', async () => {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    const fetcher = async () => new Response(JSON.stringify({ mode: 'compliance', lockedUntil: new Date().toISOString() }), { status: 200 });
    await expect(new HttpObjectStore('https://objects.internal', 'b'.repeat(43), fetcher).lock('object:audit-evidence', until)).rejects.toThrow('OBJECT_LOCK_RESPONSE_INVALID');
  });

  it('classifies a dependency outage without exposing its body', async () => {
    const store = new HttpObjectStore('https://objects.internal', 'b'.repeat(43), async () => new Response('internal secret', { status: 503 }));
    await expect(store.inspect('object:opaque')).rejects.toMatchObject({
      code: 'OBJECT_STORE_UNAVAILABLE',
      kind: 'unavailable',
      retryable: true,
      status: 503,
    });
  });

  it('accepts only a bounded upload grant whose signed headers match every immutable input', async () => {
    const now = Date.now();
    const retentionUntil = new Date(now + 86_400_000).toISOString();
    const expiresAt = new Date(now + 300_000).toISOString();
    const sha256 = 'a'.repeat(64);
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      json({
        reference: 'object:opaque-upload',
        url: 'https://upload.objects.internal/signed',
        method: 'PUT',
        headers: { 'Content-Type': 'image/png', 'Content-Length': '8', 'X-Content-Sha256': sha256, 'X-Retention-Until': retentionUntil },
        expiresAt,
      })
    );
    const store = new HttpObjectStore('https://objects.internal', 'b'.repeat(43), fetcher);
    await expect(store.authorizeUpload({ path: 'tenant/owner/image.png', contentType: 'image/png', size: 8, sha256, expiresIn: 300, retentionUntil })).resolves.toMatchObject({
      reference: 'object:opaque-upload',
      method: 'PUT',
      expiresAt,
      headers: { 'content-type': 'image/png', 'content-length': '8', 'x-content-sha256': sha256, 'x-retention-until': retentionUntil },
    });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ path: 'tenant/owner/image.png', contentType: 'image/png', size: 8, sha256, expiresIn: 300, retentionUntil });
  });

  it.each([
    ['content type', { 'content-type': 'application/pdf' }],
    ['length', { 'content-length': '7' }],
    ['checksum', { 'x-content-sha256': 'b'.repeat(64) }],
    ['retention', { 'x-retention-until': new Date(Date.now() + 172_800_000).toISOString() }],
  ])('rejects an upload authorization with a changed %s header', async (_name, changed) => {
    const retentionUntil = new Date(Date.now() + 86_400_000).toISOString();
    const sha256 = 'a'.repeat(64);
    const headers = { 'content-type': 'image/png', 'content-length': '8', 'x-content-sha256': sha256, 'x-retention-until': retentionUntil, ...changed };
    const fetcher = async () => json({ reference: 'object:opaque-upload', url: 'https://upload.objects.internal/signed', method: 'PUT', headers, expiresAt: new Date(Date.now() + 300_000).toISOString() });
    const store = new HttpObjectStore('https://objects.internal', 'b'.repeat(43), fetcher);
    await expect(store.authorizeUpload({ path: 'tenant/owner/image.png', contentType: 'image/png', size: 8, sha256, expiresIn: 300, retentionUntil })).rejects.toThrow('OBJECT_UPLOAD_AUTHORIZATION_RESPONSE_INVALID');
  });

  it('requires explicit lifecycle metadata and separates malware from an incomplete scan', async () => {
    const base = { reference: 'object:opaque', path: 'tenant/owner/file.pdf', sha256: 'a'.repeat(64), size: 10, contentType: 'application/pdf', scan: 'clean', retentionUntil: null, lockedUntil: null };
    await expect(storeFor(base).inspect('object:opaque')).resolves.toEqual(base);
    const { retentionUntil: _retention, ...missing } = base;
    await expect(storeFor(missing).inspect('object:opaque')).rejects.toThrow('OBJECT_METADATA_INVALID');
    await expect(storeFor({ ...base, scan: 'infected' }).inspect('object:opaque')).rejects.toThrow('OBJECT_MALWARE_DETECTED');
    await expect(storeFor({ ...base, scan: 'pending' }).inspect('object:opaque')).rejects.toThrow('OBJECT_SCAN_INCOMPLETE');
  });
});

function storeFor(body: object): HttpObjectStore {
  return new HttpObjectStore('https://objects.internal', 'b'.repeat(43), async () => json(body));
}

function json(body: object): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}
