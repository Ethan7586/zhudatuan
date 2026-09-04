import { describe, expect, it } from 'vitest';
import type { StorefrontBootstrap } from '../../../entity/session';
import { ReadHome } from '../application/ReadHome';

describe('HomeViewModel projection', () => {
  it('keeps the immutable published experience identity', () => {
    const bootstrap = {
      binding: { release: 'release:1', version: 'hash:1' },
      experience: { version: 'version:1', asOf: '2026-01-01T00:00:00.000Z', data: { pages: [] } },
    } as StorefrontBootstrap;
    expect(new ReadHome().execute(bootstrap)).toMatchObject({ release: 'release:1', version: 'version:1', hash: 'hash:1', sections: [] });
  });
});
