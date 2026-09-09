import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { navigationFeatureVersion } from '../application/service/NavigationVersion';

describe('navigation projection version', () => {
  it('is stable across flag order and differs from the legacy flag-only cache partition', () => {
    const current = navigationFeatureVersion(new Set(['MVPMALL', 'MVPGROUP']));
    const reordered = navigationFeatureVersion(new Set(['MVPGROUP', 'MVPMALL']));
    const legacy = createHash('sha256').update(['MVPGROUP', 'MVPMALL'].join('\u001f')).digest('hex');
    expect(current).toBe(reordered);
    expect(current).not.toBe(legacy);
  });
});
