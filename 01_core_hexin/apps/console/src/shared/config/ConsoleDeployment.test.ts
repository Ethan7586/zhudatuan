import { describe, expect, it } from 'vitest';
import { createConsoleVersion, parseConsoleVersion } from './ConsoleDeployment';

const latestSha = 'f14b2593074d2ad5be01d7a85c2cf664f21040e2';

describe('Console deployment provenance', () => {
  it('keeps branch, SHA and build time in a readable artifact', () => {
    const version = createConsoleVersion({
      sourceBranch: 'zdt-next',
      sourceSha: latestSha,
      builtAt: '2026-09-11T02:30:00.000Z',
      sourceTree: 'clean',
      buildId: 'f14b2593074d',
    });

    expect(parseConsoleVersion(JSON.parse(JSON.stringify(version)))).toEqual(version);
  });

});
