import { describe, expect, it } from 'vitest';
import { experienceCopyIdentity } from './ExperienceCopy';

describe('experienceCopyIdentity', () => {
  it('keeps generated copy values inside the application contract', () => {
    const identity = experienceCopyIdentity(
      {
        name: '极'.repeat(120),
        code: 'ZHUDATUAN_REHEARSAL_30202641',
        public_slug: 'z'.repeat(48),
      },
      36 ** 7
    );

    expect(identity.name).toHaveLength(120);
    expect(identity.code).toHaveLength(32);
    expect(identity.slug).toHaveLength(48);
    expect(identity.code).toMatch(/^[A-Z][A-Z0-9_]{2,31}$/);
    expect(identity.slug).toMatch(/^[a-z0-9][a-z0-9-]{2,47}$/);
  });

  it('uses the nonce to avoid repeated-copy collisions', () => {
    const source = { name: '商城', code: 'MALL', public_slug: 'mall' };
    expect(experienceCopyIdentity(source, 1)).not.toEqual(experienceCopyIdentity(source, 2));
  });
});
