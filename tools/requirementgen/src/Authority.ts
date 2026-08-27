import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

export interface RequirementAuthority {
  readonly logicalSource: string;
  readonly repositoryRelativePath: string;
  readonly sha256: string;
  readonly sheets: Readonly<{
    requirements: number;
    mvp: number;
    providers: number;
  }>;
}

interface AuthorityDocument {
  readonly requirements?: RequirementAuthority;
}

export async function loadRequirementAuthority(root: string): Promise<Readonly<{
  authority: RequirementAuthority;
  bytes: Uint8Array;
  path: string;
}>> {
  const repositoryRoot = await realpath(root);
  const configPath = await realpath(resolve(repositoryRoot, 'config/authorities.yml'));
  assertInsideRepository(repositoryRoot, configPath);
  const document = parse(await readFile(configPath, 'utf8')) as AuthorityDocument;
  const authority = document.requirements;
  if (!authority) throw new Error('REQUIREMENT_AUTHORITY_MISSING:' + configPath);
  assertRepositoryRelativePath(authority.repositoryRelativePath);

  const candidatePath = resolve(repositoryRoot, authority.repositoryRelativePath);
  assertInsideRepository(repositoryRoot, candidatePath);
  const path = await realpath(candidatePath);
  assertInsideRepository(repositoryRoot, path);
  const bytes = new Uint8Array(await readFile(path));
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== authority.sha256) {
    throw new Error('REQUIREMENT_AUTHORITY_HASH_INVALID:' + actualHash);
  }
  return Object.freeze({ authority: Object.freeze(authority), bytes, path });
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
