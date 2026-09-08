import { describe, expect, it } from 'vitest';
import { VersionedKey } from './VersionedKey';

describe('VersionedKey', () => {
  it('uses only the fields declared by the cache catalog', () => {
    const active = VersionedKey.create('publishedexperience', { mall: 'mall:1', publicationversion: 'active' });
    const version = VersionedKey.create('publishedexperience', { mall: 'mall:1', publicationversion: 'version:9' });
    expect(active).not.toBe(version);
    expect(active).toMatch(/^shop:v1:publishedexperience:/);
    expect(() => VersionedKey.create('publishedexperience', { mall: 'mall:1' })).toThrow('CACHE_KEY_FIELDS_INVALID');
    expect(() => VersionedKey.create('publishedexperience', { mall: 'mall:1', version: 'active' })).toThrow('CACHE_KEY_FIELDS_INVALID');
  });
});
