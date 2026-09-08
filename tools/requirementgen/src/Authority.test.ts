import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadRequirementAuthority } from './Authority';

describe('requirement authority', () => {
  it('binds the canonical repository workbook by content hash', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const result = await loadRequirementAuthority(root);

    expect(result.authority.logicalSource).toBe('RepositoryAuthority docs/福利商城功能清单.xlsx');
    expect(result.authority.repositoryRelativePath).toBe('docs/福利商城功能清单.xlsx');
    expect(result.authority.sha256).toBe('48b2a8ea94b9b20d2599772d8fe1871637f48dbbbc3408e09e0ea8a1822e7436');
    expect(result.authority.range).toBe('A1:F24');
    expect(result.authority.selectionRange).toBe('A3:F24');
    expect(result.authority.reviewedAt).toBe('2026-09-08');
    expect(result.authority.authorityOrder).toHaveLength(6);
    expect(result.authority.sheets).toEqual({ requirements: 296, mvp: 22, providers: 20 });
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('rejects parent traversal before reading the authority', async () => {
    const fixture = await createFixture('../outside.xlsx');
    try {
      await expect(loadRequirementAuthority(fixture.root)).rejects.toThrow('REQUIREMENT_AUTHORITY_PATH_INVALID');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

  it('rejects a repository symlink that resolves outside the repository', async () => {
    const fixture = await createFixture('docs/authority.xlsx');
    try {
      await mkdir(join(fixture.root, 'docs'));
      await symlink(fixture.outside, join(fixture.root, 'docs/authority.xlsx'));
      await expect(loadRequirementAuthority(fixture.root)).rejects.toThrow('REQUIREMENT_AUTHORITY_OUTSIDE_REPOSITORY');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });
});

async function createFixture(repositoryRelativePath: string) {
  const directory = await mkdtemp(join(tmpdir(), 'smart-wing-authority-'));
  const root = join(directory, 'repository');
  const outside = join(directory, 'outside.xlsx');
  const bytes = new TextEncoder().encode('authority');
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(outside, bytes);
  await writeFile(
    join(root, 'config/authorities.yml'),
    [
      'version: 1',
      'requirements:',
      '  logicalSource: fixture',
      `  repositoryRelativePath: ${repositoryRelativePath}`,
      `  sha256: ${createHash('sha256').update(bytes).digest('hex')}`,
      '  sheets:',
      '    requirements: 0',
      '    mvp: 0',
      '    providers: 0',
    ].join('\n')
  );
  return { directory, root, outside };
}
