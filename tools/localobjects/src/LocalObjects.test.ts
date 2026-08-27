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

test('rejects reordered upload parts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-objects-'));
  const objects = new LocalObjects(directory, randomBytes(32).toString('base64url'), 'https://127.0.0.1:8445');
  await objects.initialize();
  const id = objects.create('evidence/local.txt', 'text/plain');
  assert.throws(() => objects.append(id, 1, new Uint8Array([1])), /OBJECT_UPLOAD_CHUNK_INVALID/);
});
