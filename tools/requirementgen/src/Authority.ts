import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

export interface RequirementAuthority {
  readonly logicalSource: string;
  readonly repositoryRelativePath: string;
  readonly sha256: string;
<<<<<<< HEAD
<<<<<<< HEAD
  readonly profile?: string;
  readonly sheets: Readonly<Record<string, number>>;
}

export interface LoadedRequirementAuthority {
  readonly authorityName: string;
  readonly authority: RequirementAuthority;
  readonly bytes: Uint8Array;
  readonly path: string;
}

export async function loadRequirementAuthority(root: string, authorityName = 'requirements'): Promise<Readonly<LoadedRequirementAuthority>> {
  const repositoryRoot = await realpath(root);
  const authorities = await loadRequirementAuthorities(repositoryRoot);
  const authority = authorities.get(authorityName);
  if (!authority) throw new Error('REQUIREMENT_AUTHORITY_MISSING:' + authorityName);
=======
  readonly sheets: Readonly<{
    requirements: number;
    mvp: number;
    providers: number;
  }>;
=======
  readonly profile?: string;
  readonly sheets: Readonly<Record<string, number>>;
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
}

export interface LoadedRequirementAuthority {
  readonly authorityName: string;
  readonly authority: RequirementAuthority;
  readonly bytes: Uint8Array;
  readonly path: string;
}

export async function loadRequirementAuthority(root: string, authorityName = 'requirements'): Promise<Readonly<LoadedRequirementAuthority>> {
  const repositoryRoot = await realpath(root);
<<<<<<< HEAD
  const configPath = await realpath(resolve(repositoryRoot, 'config/authorities.yml'));
  assertInsideRepository(repositoryRoot, configPath);
  const document = parse(await readFile(configPath, 'utf8')) as AuthorityDocument;
  const authority = document.requirements;
  if (!authority) throw new Error('REQUIREMENT_AUTHORITY_MISSING:' + configPath);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const authorities = await loadRequirementAuthorities(repositoryRoot);
  const authority = authorities.get(authorityName);
  if (!authority) throw new Error('REQUIREMENT_AUTHORITY_MISSING:' + authorityName);
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
  assertRepositoryRelativePath(authority.repositoryRelativePath);

  const candidatePath = resolve(repositoryRoot, authority.repositoryRelativePath);
  assertInsideRepository(repositoryRoot, candidatePath);
  const path = await realpath(candidatePath);
  assertInsideRepository(repositoryRoot, path);
  const bytes = new Uint8Array(await readFile(path));
  const actualHash = createHash('sha256').update(bytes).digest('hex');
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
  if (actualHash !== authority.sha256) throw new Error('REQUIREMENT_AUTHORITY_HASH_INVALID:' + authorityName + ':' + actualHash);
  return Object.freeze({ authorityName, authority, bytes, path });
}

export async function loadRequirementAuthorities(root: string): Promise<ReadonlyMap<string, RequirementAuthority>> {
  const repositoryRoot = await realpath(root);
  const configPath = await realpath(resolve(repositoryRoot, 'config/authorities.yml'));
  assertInsideRepository(repositoryRoot, configPath);
  const document = objectValue(parse(await readFile(configPath, 'utf8')), 'document');
  if (document.version !== 1) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:version');
  const authorities = new Map<string, RequirementAuthority>();
  for (const [name, value] of Object.entries(document)) {
    if (name !== 'version') authorities.set(name, authorityValue(value, name));
<<<<<<< HEAD
  }
  if (!authorities.has('requirements')) throw new Error('REQUIREMENT_AUTHORITY_MISSING:requirements');
  return authorities;
=======
  if (actualHash !== authority.sha256) {
    throw new Error('REQUIREMENT_AUTHORITY_HASH_INVALID:' + actualHash);
  }
  return Object.freeze({ authority: Object.freeze(authority), bytes, path });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  }
  if (!authorities.has('requirements')) throw new Error('REQUIREMENT_AUTHORITY_MISSING:requirements');
  return authorities;
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
}

function assertRepositoryRelativePath(path: unknown): asserts path is string {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path) || path.split(/[\\/]/).includes('..')) {
    throw new Error('REQUIREMENT_AUTHORITY_PATH_INVALID:' + String(path));
  }
}

function assertInsideRepository(root: string, path: string): void {
  const repositoryPath = relative(root, path);
  if (repositoryPath === '' || repositoryPath === '..' || repositoryPath.startsWith(`..${sep}`) || isAbsolute(repositoryPath)) {
    throw new Error('REQUIREMENT_AUTHORITY_OUTSIDE_REPOSITORY:' + path);
  }
}
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)

function authorityValue(value: unknown, name: string): RequirementAuthority {
  const authority = objectValue(value, name);
  const logicalSource = stringValue(authority.logicalSource, name + ':logicalSource');
  const repositoryRelativePath = stringValue(authority.repositoryRelativePath, name + ':repositoryRelativePath');
  const sha256 = stringValue(authority.sha256, name + ':sha256');
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:' + name + ':sha256');
  const sheetDocument = objectValue(authority.sheets, name + ':sheets');
  const sheets: Record<string, number> = {};
  for (const [sheet, count] of Object.entries(sheetDocument)) {
    if (!Number.isSafeInteger(count) || Number(count) < 0) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:' + name + ':sheets:' + sheet);
    sheets[sheet] = Number(count);
  }
  if (Object.keys(sheets).length === 0) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:' + name + ':sheets');
  const profile = authority.profile === undefined ? undefined : stringValue(authority.profile, name + ':profile');
  return Object.freeze({ logicalSource, repositoryRelativePath, sha256, ...(profile === undefined ? {} : { profile }), sheets: Object.freeze(sheets) });
}

function objectValue(value: unknown, location: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:' + location);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, location: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('REQUIREMENT_AUTHORITY_CONFIG_INVALID:' + location);
  return value;
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
