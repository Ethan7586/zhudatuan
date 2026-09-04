import { describe, expect, it } from 'vitest';
import { VersionedKey } from './VersionedKey';

describe('VersionedKey', () => {
  it('uses only the fields declared by the cache catalog', () => {
    const active = VersionedKey.create('experience', { mall: 'mall:1', version: 'active' });
    const version = VersionedKey.create('experience', { mall: 'mall:1', version: 'version:9' });
    expect(active).not.toBe(version);
    expect(active).toMatch(/^shop:v1:experience:/);
    expect(() => VersionedKey.create('experience', { mall: 'mall:1' })).toThrow('CACHE_KEY_FIELDS_INVALID');
  });
});
