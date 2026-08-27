import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadRequirementAuthority } from './Authority';

describe('requirement authority', () => {
  it('binds the repository 260821 workbook by content hash', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const result = await loadRequirementAuthority(root);

    expect(result.authority.logicalSource).toBe('RepositoryAuthority docs/福利商城功能清单260821.xlsx');
    expect(result.authority.repositoryRelativePath).toBe('docs/福利商城功能清单260821.xlsx');
    expect(result.authority.sha256).toBe('78cfc3b350ced633afd6bfc951f2d2a94991780fa1d4b6d571e9f1d3df322942');
    expect(result.authority.sheets).toEqual({ requirements: 296, mvp: 21, providers: 20 });
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
  await writeFile(join(root, 'config/authorities.yml'), [
    'version: 1',
    'requirements:',
    '  logicalSource: fixture',
    `  repositoryRelativePath: ${repositoryRelativePath}`,
    `  sha256: ${createHash('sha256').update(bytes).digest('hex')}`,
    '  sheets:',
    '    requirements: 0',
    '    mvp: 0',
    '    providers: 0',
  ].join('\n'));
  return { directory, root, outside };
}
