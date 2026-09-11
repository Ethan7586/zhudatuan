import { describe, expect, it, vi } from 'vitest';
import { assertConsoleDeploymentCandidate, createConsoleVersion, parseConsoleVersion, type ConsoleVersion } from './ConsoleDeployment';

const currentSha = '3a3e5db94385f8b84364b97a48544e24535f2c80';
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

  it('accepts only the latest clean zdt-next build that contains production', () => {
    const version = createConsoleVersion({
      sourceBranch: 'zdt-next',
      sourceSha: latestSha,
      builtAt: '2026-09-11T02:30:00.000Z',
      sourceTree: 'clean',
      buildId: 'f14b2593074d',
    });
    const isAncestor = vi.fn(() => true);

    expect(() => assertConsoleDeploymentCandidate(version, latestSha, currentSha, isAncestor)).not.toThrow();
    expect(isAncestor).toHaveBeenCalledWith(currentSha, latestSha);
  });

  const invalidCandidates: ReadonlyArray<readonly [string, Partial<Omit<ConsoleVersion, 'schema'>>, string]> = [
    ['old branch', { sourceBranch: 'main' }, 'CONSOLE_DEPLOY_SOURCE_BRANCH_NOT_ZDT_NEXT'],
    ['dirty output', { sourceTree: 'dirty' }, 'CONSOLE_DEPLOY_SOURCE_TREE_DIRTY'],
    ['stale dist', { sourceSha: currentSha }, 'CONSOLE_DEPLOY_DIST_NOT_LATEST_ZDT_NEXT'],
  ];

  it.each(invalidCandidates)('rejects %s', (_label, override, code) => {
    const version = createConsoleVersion({
      sourceBranch: 'zdt-next',
      sourceSha: latestSha,
      builtAt: '2026-09-11T02:30:00.000Z',
      sourceTree: 'clean',
      buildId: 'f14b2593074d',
      ...override,
    } as Omit<ConsoleVersion, 'schema'>);

    expect(() => assertConsoleDeploymentCandidate(version, latestSha, currentSha, () => true)).toThrow(code);
  });

  it('rejects a build that does not contain the current production source', () => {
    const version = createConsoleVersion({
      sourceBranch: 'zdt-next',
      sourceSha: latestSha,
      builtAt: '2026-09-11T02:30:00.000Z',
      sourceTree: 'clean',
      buildId: 'f14b2593074d',
    });

    expect(() => assertConsoleDeploymentCandidate(version, latestSha, currentSha, () => false)).toThrow(
      'CONSOLE_DEPLOY_WOULD_REPLACE_NEWER_PRODUCTION',
    );
  });
});
