import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalObjects } from './LocalObjects';

test('persists an integrity-checked multipart object', async () => {
  const fixture = await localObjects();
  try {
    const bytes = new TextEncoder().encode('local object');
    const id = fixture.objects.create('evidence/local.txt', 'text/plain');
    fixture.objects.append(id, 0, bytes);
    const metadata = await fixture.objects.complete(id, 1, sha256(bytes), bytes.byteLength);
    assert.equal((await fixture.objects.find('evidence/local.txt'))?.reference, metadata.reference);
    assert.deepEqual((await fixture.objects.read(metadata.reference)).bytes, bytes);
    assert.equal(metadata.retentionUntil, null);
    assert.equal(metadata.lockedUntil, null);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects reordered upload parts', async () => {
  const fixture = await localObjects();
  try {
    const id = fixture.objects.create('evidence/local.txt', 'text/plain');
    assert.throws(() => fixture.objects.append(id, 1, new Uint8Array([1])), /OBJECT_UPLOAD_CHUNK_INVALID/);
  } finally {
    await fixture.cleanup();
  }
});

test('binds a presigned upload to path, type, length, checksum and retention', async () => {
  const fixture = await localObjects();
  try {
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    const retentionUntil = new Date(Date.now() + 86_400_000).toISOString();
    const grant = fixture.objects.authorizeUpload({ path: 'tenant/owner/attachment/image.png', contentType: 'image/png',
      size: bytes.byteLength, sha256: sha256(bytes), expiresIn: 60, retentionUntil });
    const target = new URL(grant.url);
    const metadata = await fixture.objects.writeAuthorized(target.pathname.split('/').at(-1) ?? '', target.searchParams.get('expires'),
      target.searchParams.get('signature'), grant.headers, bytes);
    assert.equal(metadata.reference, grant.reference);
    assert.equal(metadata.path, 'tenant/owner/attachment/image.png');
    assert.equal(metadata.retentionUntil, retentionUntil);
    assert.deepEqual((await fixture.objects.read(grant.reference)).bytes, bytes);
  } finally {
    await fixture.cleanup();
  }
});

test('rejects a forged grant, changed headers, changed bytes and malware', async () => {
  const fixture = await localObjects();
  try {
    const original = new TextEncoder().encode('safe payload');
    const grant = fixture.objects.authorizeUpload(uploadRequest('tenant/owner/attachment/safe.pdf', 'application/pdf', original));
    const target = new URL(grant.url);
    const id = target.pathname.split('/').at(-1) ?? '';
    await assert.rejects(() => fixture.objects.writeAuthorized(id, target.searchParams.get('expires'), 'forged', grant.headers, original), /OBJECT_UPLOAD_GRANT_INVALID/);
    await assert.rejects(() => fixture.objects.writeAuthorized(id, target.searchParams.get('expires'), target.searchParams.get('signature'),
      { ...grant.headers, 'content-type': 'image/png' }, original), /OBJECT_UPLOAD_GRANT_INVALID/);
    const changed = original.map((value, index) => index === 0 ? value + 1 : value);
    await assert.rejects(() => fixture.objects.writeAuthorized(id, target.searchParams.get('expires'), target.searchParams.get('signature'), grant.headers, changed), /OBJECT_UPLOAD_INTEGRITY_INVALID/);

    const infected = new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    const infectedGrant = fixture.objects.authorizeUpload(uploadRequest('tenant/owner/attachment/infected.pdf', 'application/pdf', infected));
    const infectedTarget = new URL(infectedGrant.url);
    await assert.rejects(() => fixture.objects.writeAuthorized(infectedTarget.pathname.split('/').at(-1) ?? '', infectedTarget.searchParams.get('expires'),
      infectedTarget.searchParams.get('signature'), infectedGrant.headers, infected), /OBJECT_MALWARE_DETECTED/);
  } finally {
    await fixture.cleanup();
  }
});

test('uses opaque unique references even when object content is identical', async () => {
  const fixture = await localObjects();
  try {
    const bytes = new TextEncoder().encode('same bytes');
    const references: string[] = [];
    for (const path of ['evidence/first.txt', 'evidence/second.txt']) {
      const id = fixture.objects.create(path, 'text/plain');
      fixture.objects.append(id, 0, bytes);
      references.push((await fixture.objects.complete(id, 1, sha256(bytes), bytes.byteLength)).reference);
    }
    assert.notEqual(references[0], references[1]);
  } finally {
    await fixture.cleanup();
  }
});

test('detects stored-byte tampering and enforces retention plus non-shortenable locks', async () => {
  const fixture = await localObjects();
  try {
    const bytes = new TextEncoder().encode('immutable evidence');
    const grant = fixture.objects.authorizeUpload(uploadRequest('tenant/owner/evidence/immutable.pdf', 'application/pdf', bytes));
    const target = new URL(grant.url);
    const metadata = await fixture.objects.writeAuthorized(target.pathname.split('/').at(-1) ?? '', target.searchParams.get('expires'),
      target.searchParams.get('signature'), grant.headers, bytes);
    await assert.rejects(() => fixture.objects.remove(metadata.reference), /OBJECT_RETENTION_ACTIVE/);
    const later = new Date(Date.now() + 172_800_000).toISOString();
    assert.equal((await fixture.objects.lock(metadata.reference, later)).lockedUntil, later);
    const earlier = new Date(Date.now() + 86_400_000).toISOString();
    assert.equal((await fixture.objects.lock(metadata.reference, earlier)).lockedUntil, later);

    const id = metadata.reference.slice('local:object:'.length);
    await writeFile(join(fixture.directory, 'objects', id), new TextEncoder().encode('tampered'), { mode: 0o600 });
    await assert.rejects(() => fixture.objects.read(metadata.reference), /LOCAL_OBJECT_CONTENT_CORRUPT/);
  } finally {
    await fixture.cleanup();
  }
});

function uploadRequest(path: string, contentType: string, bytes: Uint8Array) {
  return { path, contentType, size: bytes.byteLength, sha256: sha256(bytes), expiresIn: 60,
    retentionUntil: new Date(Date.now() + 86_400_000).toISOString() };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function localObjects(): Promise<Readonly<{ directory: string; objects: LocalObjects; cleanup(): Promise<void> }>> {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  return Object.freeze({ directory, objects, cleanup: () => rm(directory, { recursive: true, force: true }) });
}
