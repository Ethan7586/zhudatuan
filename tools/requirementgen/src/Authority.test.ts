import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

<<<<<<< HEAD
<<<<<<< HEAD
import { loadRequirementAuthorities, loadRequirementAuthority } from './Authority';
=======
import { loadRequirementAuthority } from './Authority';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { loadRequirementAuthorities, loadRequirementAuthority } from './Authority';
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)

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

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
  it('binds the independent Smart Wing OMS authority without replacing the commerce authority', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const authorities = await loadRequirementAuthorities(root);
    const result = await loadRequirementAuthority(root, 'orderRequirements');

    expect([...authorities.keys()]).toEqual(['requirements', 'orderRequirements']);
    expect(result.authority.logicalSource).toBe('RepositoryAuthority docs/订单需求20260430.xlsx');
    expect(result.authority.repositoryRelativePath).toBe('docs/订单需求20260430.xlsx');
    expect(result.authority.sha256).toBe('2d26811cd4fe3fca65f126432a71f176628d12ff262cd0844498abc3fec9e79e');
    expect(result.authority.sheets).toEqual({ '20260430需求汇总': 274, '20250416需求汇总': 16 });
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('rejects authority content whose hash no longer matches the declaration', async () => {
    const fixture = await createFixture('docs/authority.xlsx', 'a'.repeat(64));
    try {
      await mkdir(join(fixture.root, 'docs'));
      await writeFile(join(fixture.root, 'docs/authority.xlsx'), 'changed authority');
      await expect(loadRequirementAuthority(fixture.root)).rejects.toThrow('REQUIREMENT_AUTHORITY_HASH_INVALID');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
  it('rejects parent traversal before reading the authority', async () => {
    const fixture = await createFixture('../outside.xlsx');
    try {
      await expect(loadRequirementAuthority(fixture.root)).rejects.toThrow('REQUIREMENT_AUTHORITY_PATH_INVALID');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
  it('rejects an absolute authority path before reading the authority', async () => {
    const fixture = await createFixture(resolve(tmpdir(), 'absolute-authority.xlsx'));
    try {
      await expect(loadRequirementAuthority(fixture.root)).rejects.toThrow('REQUIREMENT_AUTHORITY_PATH_INVALID');
    } finally {
      await rm(fixture.directory, { recursive: true, force: true });
    }
  });

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
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

<<<<<<< HEAD
<<<<<<< HEAD
async function createFixture(repositoryRelativePath: string, declaredHash?: string) {
=======
async function createFixture(repositoryRelativePath: string) {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
async function createFixture(repositoryRelativePath: string, declaredHash?: string) {
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
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
<<<<<<< HEAD
<<<<<<< HEAD
    `  sha256: ${declaredHash ?? createHash('sha256').update(bytes).digest('hex')}`,
=======
    `  sha256: ${createHash('sha256').update(bytes).digest('hex')}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    `  sha256: ${declaredHash ?? createHash('sha256').update(bytes).digest('hex')}`,
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
    '  sheets:',
    '    requirements: 0',
    '    mvp: 0',
    '    providers: 0',
  ].join('\n'));
  return { directory, root, outside };
}
