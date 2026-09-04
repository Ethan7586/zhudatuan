import { describe, expect, it } from 'vitest';
import { exactOperationOutput } from './index';

const summary = Object.freeze({
  id: 'application:one',
  mallId: 'mall:one',
  mallName: '一号福利商城',
  brandName: '一号品牌',
  code: 'MALLONE',
  publicSlug: 'mall-one',
  name: '一号商城',
  status: 'active',
  version: 3,
  headSequence: 3,
  publishedSequence: 2,
  theme: { preset: 'shop', primaryColor: '#2563eb', accentColor: '#f97316', logoObjectRef: null, faviconObjectRef: null },
  domain: { mode: 'platform', address: 'https://fufu.wang/s/mall-one', state: 'ready' },
  updatedAt: '2026-09-01T00:00:00.000Z',
  entry: { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one', state: 'ready', releaseId: 'release:one', releaseVersion: 'version:two', contentHash: 'a'.repeat(64) },
});

describe('experience entry contract', () => {
  const schema = exactOperationOutput('ExperienceApplicationsReadOutput');

  it('accepts the strict ready state', () => {
    expect(schema.safeParse({ items: [summary], count: 1 }).success).toBe(true);
  });

  it('requires entry and rejects every additional property', () => {
    const missing = Object.fromEntries(Object.entries(summary).filter(([key]) => key !== 'entry'));
    expect(schema.safeParse({ items: [missing], count: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...summary, auxiliary: true }], count: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...summary, entry: { ...summary.entry, auxiliary: true } }], count: 1 }).success).toBe(false);
  });

  it('requires release facts only for ready and forbids fabricated release facts otherwise', () => {
    const missingRelease = Object.fromEntries(Object.entries(summary.entry).filter(([key]) => key !== 'releaseId'));
    expect(schema.safeParse({ items: [{ ...summary, entry: missingRelease }], count: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...summary, entry: { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one', state: 'unpublished', releaseId: 'release:fake' } }], count: 1 }).success).toBe(false);
  });

  it.each(['ready', 'unpublished', 'disabled', 'invalid'] as const)('accepts the complete %s state', (state) => {
    const entry = state === 'ready' ? summary.entry : state === 'invalid' ? { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one', state, requestId: 'request:one' } : { handle: 'mall-one', url: 'https://fufu.wang/s/mall-one', state };
    expect(schema.safeParse({ items: [{ ...summary, entry }], count: 1 }).success).toBe(true);
  });

  it('rejects insecure URLs and malformed hashes', () => {
    expect(schema.safeParse({ items: [{ ...summary, entry: { ...summary.entry, url: 'http://fufu.wang/s/mall-one' } }], count: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...summary, entry: { ...summary.entry, url: 'http://127.0.0.1:3000/s/mall-one' } }], count: 1 }).success).toBe(true);
    expect(schema.safeParse({ items: [{ ...summary, entry: { ...summary.entry, url: 'http://localhost:3000/s/mall-one' } }], count: 1 }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...summary, entry: { ...summary.entry, contentHash: 'hash' } }], count: 1 }).success).toBe(false);
  });
});
