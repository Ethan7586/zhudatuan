import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { LocalObjects } from './LocalObjects';

test('persists an integrity-checked multipart object', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  const bytes = new TextEncoder().encode('local object');
  const id = objects.create('evidence/local.txt', 'text/plain');
  objects.append(id, 0, bytes);
  const metadata = await objects.complete(id, 1, createHash('sha256').update(bytes).digest('hex'), bytes.byteLength);
  assert.equal((await objects.find('evidence/local.txt'))?.reference, metadata.reference);
  assert.deepEqual((await objects.read(metadata.reference)).bytes, bytes);
});

<<<<<<< HEAD
test('deletes a completed object and invalidates its path and signed URL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  const bytes = new TextEncoder().encode('delete-after-readiness');
  const id = objects.create('evidence/delete.txt', 'text/plain');
  objects.append(id, 0, bytes);
  const metadata = await objects.complete(id, 1, createHash('sha256').update(bytes).digest('hex'), bytes.byteLength);
  const signed = new URL((await objects.authorize(metadata.reference, 60)).url);

  await objects.delete(metadata.reference);

  assert.equal(await objects.find(metadata.path), undefined);
  await assert.rejects(objects.read(metadata.reference), /OBJECT_NOT_FOUND/);
  await assert.rejects(objects.readAuthorized(metadata.reference, signed.searchParams.get('expires'),
    signed.searchParams.get('signature')), /OBJECT_NOT_FOUND/);
  await assert.rejects(objects.delete(metadata.reference), /OBJECT_NOT_FOUND/);
});

test('keeps identical bytes at different paths independently addressable and deletable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  const bytes = new TextEncoder().encode('shared bytes');
  const expectedHash = createHash('sha256').update(bytes).digest('hex');
  const first = objects.create('evidence/first.txt', 'text/plain');
  objects.append(first, 0, bytes);
  const firstMetadata = await objects.complete(first, 1, expectedHash, bytes.byteLength);
  const second = objects.create('evidence/second.txt', 'text/plain');
  objects.append(second, 0, bytes);
  const secondMetadata = await objects.complete(second, 1, expectedHash, bytes.byteLength);

  assert.notEqual(firstMetadata.reference, secondMetadata.reference);
  assert.equal((await objects.find(firstMetadata.path))?.path, firstMetadata.path);
  assert.equal((await objects.find(secondMetadata.path))?.path, secondMetadata.path);
  await objects.delete(firstMetadata.reference);
  assert.deepEqual((await objects.read(secondMetadata.reference)).bytes, bytes);
  assert.equal((await objects.find(secondMetadata.path))?.reference, secondMetadata.reference);
});

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
test('rejects reordered upload parts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  const id = objects.create('evidence/local.txt', 'text/plain');
  assert.throws(() => objects.append(id, 1, new Uint8Array([1])), /OBJECT_UPLOAD_CHUNK_INVALID/);
});
