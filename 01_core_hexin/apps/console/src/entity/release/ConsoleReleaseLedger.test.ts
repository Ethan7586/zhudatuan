import { describe, expect, it } from 'vitest';
import { CONSOLE_RELEASES, CURRENT_CONSOLE_RELEASE } from './ConsoleReleaseLedger';

describe('Console release ledger', () => {
  it('keeps one current human-readable version at the top', () => {
    expect(CURRENT_CONSOLE_RELEASE).toBe(CONSOLE_RELEASES[0]);
    expect(CURRENT_CONSOLE_RELEASE).toMatchObject({ version: 'v1.1.0', status: 'current', surface: '福福网 Console' });
    expect(CONSOLE_RELEASES.filter(({ status }) => status === 'current')).toHaveLength(1);
  });

  it('keeps versions unique and every release explainable', () => {
    expect(new Set(CONSOLE_RELEASES.map(({ version }) => version)).size).toBe(CONSOLE_RELEASES.length);
    for (const release of CONSOLE_RELEASES) {
      expect(release.title.length).toBeGreaterThan(0);
      expect(release.changes.length).toBeGreaterThan(0);
      expect(release.changes.every(({ items }) => items.length > 0)).toBe(true);
      expect(release.channel.length).toBeGreaterThan(0);
      expect(release.target.length).toBeGreaterThan(0);
    }
  });
});
