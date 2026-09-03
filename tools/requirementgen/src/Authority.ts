import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';

export interface RequirementAuthority {
  readonly logicalSource: string;
  readonly repositoryRelativePath: string;
  readonly sha256: string;
  readonly sheet: string;
  readonly range: string;
  readonly parserVersion: number;
  readonly generatorVersion: number;
  readonly generatedAt: string;
  readonly sheets: Readonly<{
    requirements: number;
    mvp: number;
    providers: number;
  }>;
}

interface AuthorityDocument {
  readonly requirements?: RequirementAuthority;
  readonly architecture?: readonly Readonly<{ repositoryRelativePath: string; sha256: string }>[];
  readonly navigation?: Readonly<{ repositoryRelativePath: string; sha256: string; version: number }>;
  readonly visuals?: Readonly<{ repositoryRelativePath: string; sha256: string }>;
}

export async function loadRequirementAuthority(root: string): Promise<
  Readonly<{
    authority: RequirementAuthority;
    bytes: Uint8Array;
    path: string;
  }>
> {
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
  if (authority.sheet !== 'MVP上线功能清单' || authority.range !== 'A1:F24' || authority.sheets.mvp !== 22 || authority.parserVersion !== 3 || authority.generatorVersion !== 4) {
    throw new Error('REQUIREMENT_AUTHORITY_BASELINE_INVALID');
  }
  const bytes = new Uint8Array(await readFile(path));
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== authority.sha256) {
    throw new Error('REQUIREMENT_AUTHORITY_HASH_INVALID:' + actualHash);
  }
  if (document.architecture?.length !== 1 || document.architecture[0]?.repositoryRelativePath !== 'docs/architecture/前端整体重构方案.md') {
    throw new Error('ARCHITECTURE_AUTHORITY_INVALID');
  }
  await verifyAuthority(repositoryRoot, document.architecture[0]);
  if (document.navigation?.version !== 2) throw new Error('ROUTE_CATALOG_VERSION_INVALID');
  await verifyAuthority(repositoryRoot, required(document.navigation, 'NAVIGATION_AUTHORITY_MISSING'));
  await verifyAuthority(repositoryRoot, required(document.visuals, 'VISUAL_AUTHORITY_MISSING'));
  const visualDocument = parse(await readFile(resolve(repositoryRoot, document.visuals!.repositoryRelativePath), 'utf8')) as { readonly authority?: { readonly source?: unknown } };
  const visualSource = visualDocument.authority?.source;
  if (typeof visualSource !== 'string') throw new Error('VISUAL_SOURCE_INVALID');
  assertRepositoryRelativePath(visualSource);
  return Object.freeze({ authority: Object.freeze(authority), bytes, path });
}

async function verifyAuthority(root: string, authority: Readonly<{ repositoryRelativePath: string; sha256: string }>): Promise<void> {
  assertRepositoryRelativePath(authority.repositoryRelativePath);
  const path = resolve(root, authority.repositoryRelativePath);
  assertInsideRepository(root, path);
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== authority.sha256) throw new Error(`AUTHORITY_HASH_INVALID:${authority.repositoryRelativePath}:${actual}`);
}

function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
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
