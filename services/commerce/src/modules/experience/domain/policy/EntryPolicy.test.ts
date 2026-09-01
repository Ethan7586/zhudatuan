import { describe, expect, it } from 'vitest';
import { EntryPolicy, type EntryFacts } from './EntryPolicy';

const ready: EntryFacts = Object.freeze({
  applicationStatus: 'active',
  release: 'release:one',
  version: 'version:one',
  validationState: 'valid',
  publicationState: 'active',
  contentHash: 'a'.repeat(64),
  configurationHash: 'a'.repeat(64),
  objectKey: 'experience/one.json',
  pool: 'pool:one',
});

describe('EntryPolicy', () => {
  const policy = new EntryPolicy();

  it('covers every public entry state without exposing an invalid publication', () => {
    expect(policy.decide(ready)).toBe('ready');
    expect(policy.decide({ ...ready, release: null })).toBe('unpublished');
    expect(policy.decide({ ...ready, applicationStatus: 'disabled' })).toBe('disabled');
    expect(policy.decide({ ...ready, configurationHash: 'b'.repeat(64) })).toBe('invalid');
  });

  it.each([{ version: null }, { pool: null }, { validationState: 'invalid' }, { publicationState: 'retired' }, { contentHash: null }, { objectKey: null }, { applicationStatus: 'draft' }])(
    'fails closed for incomplete publication facts: %o',
    (change) => {
      expect(policy.decide({ ...ready, ...change })).toBe('invalid');
    }
  );
});
