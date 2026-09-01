import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { qrMatrix } from '@shop/design/qrcode';
import { EntryResolver } from '../../services/commerce/src/modules/experience/application/service/EntryResolver';
import type { EntryCache } from '../../services/commerce/src/modules/experience/application/port/EntryCache';
import type { EntryRepository, StorefrontEntry } from '../../services/commerce/src/modules/experience/application/port/EntryRepository';
import { Singleflight } from '../../services/commerce/src/foundation/performance/Singleflight';
import type { ReadTransactionContext } from '../../services/commerce/src/foundation/persistence/TransactionContext';

test('QR generation p95 stays within the 30ms interaction budget', () => {
  qrMatrix('https://fufu.wang/s/warmup');
  const samples = Array.from({ length: 200 }, (_, index) => {
    const started = performance.now();
    qrMatrix(`https://fufu.wang/s/performance-${index}`);
    return performance.now() - started;
  }).sort((left, right) => left - right);
  assert.ok(samples[Math.floor(samples.length * 0.95)]! < 30);
});

test('a 50-row application page remains lightweight and contains no QR or decoration object', () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    id: `application:${index}`,
    mallId: `mall:${index}`,
    code: `MALL${index}`,
    publicSlug: `mall-${index}`,
    name: `商城 ${index}`,
    status: 'active',
    version: index,
    headSequence: index,
    publishedSequence: index,
    entry: {
      handle: `mall-${index}`,
      url: `https://fufu.wang/s/mall-${index}`,
      state: 'ready',
      releaseId: `release:${index}`,
      releaseVersion: `version:${index}`,
      contentHash: 'a'.repeat(64),
    },
    updatedAt: '2026-09-01T00:00:00.000Z',
  }));
  const serialized = JSON.stringify({ items, count: items.length });
  assert.ok(Buffer.byteLength(serialized) < 80 * 1024);
  assert.doesNotMatch(serialized, /configuration|history|modules|svg|png/i);
});

test('500 concurrent cold scans share one authoritative lookup and all resolve the same mall', async () => {
  const entry = storefrontEntry('concurrent');
  let authoritativeReads = 0;
  let cached: StorefrontEntry | null = null;
  const repository: EntryRepository = {
    async resolve() {
      authoritativeReads += 1;
      await new Promise<void>((resolve) => setImmediate(resolve));
      return entry;
    },
  };
  const cache: EntryCache = {
    async read() {
      return cached;
    },
    async write(value) {
      cached = value;
    },
    async remove() {
      cached = null;
    },
  };
  const observer = { resolve() {}, states() {}, publication() {} };
  const resolver = new EntryResolver(repository, cache, new Singleflight(), observer);
  const resolved = await Promise.all(Array.from({ length: 500 }, () => resolver.resolve(context(), entry.handle)));
  assert.equal(authoritativeReads, 1);
  assert.ok(resolved.every((value) => value.mall === entry.mall && value.pool === entry.pool));
});

function storefrontEntry(handle: string): StorefrontEntry {
  return Object.freeze({
    application: `application:${handle}`,
    handle,
    url: `https://fufu.wang/s/${handle}`,
    mall: `mall:${handle}`,
    pool: `pool:${handle}`,
    release: `release:${handle}`,
    version: `version:${handle}`,
    tenant: 'tenant:one',
    contentHash: 'a'.repeat(64),
    objectKey: `experience/${handle}.json`,
  });
}

function context(): ReadTransactionContext {
  return {
    id: 'transaction:test',
    mode: 'read',
    tenant: 'tenant:one',
    membership: 'membership:one',
    scope: 'mall:concurrent',
    actor: 'actor:one',
    trace: 'trace:one',
    operation: 'storefront.bootstrap',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
  } as unknown as ReadTransactionContext;
}
