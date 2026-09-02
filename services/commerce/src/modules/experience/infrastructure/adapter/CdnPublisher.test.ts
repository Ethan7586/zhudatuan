import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { serializeExperience } from '@shop/contract';
import type { ObjectStore, ObjectUpload, StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import { CdnPublisher } from './CdnPublisher';

const document = { version: 2, application: 'application:test', pages: [{ id: 'home', path: '/', blocks: [] }] };

class MemoryObjects implements ObjectStore {
  readonly values = new Map<string, { bytes: Uint8Array; object: StoredObject & { contentType: string; path: string } }>();
  creates = 0;

  async create(path: string, contentType: string): Promise<ObjectUpload> {
    this.creates += 1;
    let bytes = new Uint8Array();
    return {
      append: async (part) => {
        bytes = new Uint8Array([...bytes, ...part]);
      },
      abort: async () => undefined,
      complete: async () => {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const object = { reference: `object:${path}`, sha256, size: bytes.byteLength, scan: 'clean' as const, contentType, path };
        this.values.set(path, { bytes, object });
        this.values.set(object.reference, { bytes, object });
        return object;
      },
    };
  }
  async find(path: string) {
    return this.values.get(path)?.object ?? null;
  }
  async inspect(reference: string) {
    const value = this.values.get(reference)?.object;
    if (!value) throw new Error('NOT_FOUND');
    return value;
  }
  async read(reference: string) {
    const value = this.values.get(reference)?.bytes;
    if (!value) throw new Error('NOT_FOUND');
    return value;
  }
  async authorize(reference: string) {
    return { url: `https://objects.test/${reference}`, expiresAt: new Date(Date.now() + 60_000).toISOString() };
  }
  async authorizeUpload(): Promise<never> {
    throw new Error('NOT_SUPPORTED');
  }
}

describe('content addressed experience publisher', () => {
  it('uploads verified canonical bytes once and reuses the immutable object', async () => {
    const objects = new MemoryObjects();
    const publisher = new CdnPublisher(objects);
    const bytes = serializeExperience(document);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const path = `experience/application-test/${hash}.json`;
    const first = await publisher.publish(path, document, hash, new AbortController().signal);
    const second = await publisher.publish(path, document, hash, new AbortController().signal);
    expect(first.sha256).toBe(hash);
    expect(second.reference).toBe(first.reference);
    expect(objects.creates).toBe(1);
  });

  it('rejects a hash that does not describe the canonical payload', async () => {
    await expect(new CdnPublisher(new MemoryObjects()).publish(`experience/application-test/${'0'.repeat(64)}.json`, document, '0'.repeat(64), new AbortController().signal)).rejects.toThrow('EXPERIENCE_CONTENT_HASH_MISMATCH');
  });
});
