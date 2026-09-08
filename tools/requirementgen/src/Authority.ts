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
  readonly reviewedAt: string;
  readonly selectionRange: string;
  readonly authorityOrder: readonly string[];
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
  readonly owners?: Readonly<Record<string, Readonly<{ module: string; authority: string }>>>;
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
  if (
    authority.sheet !== 'MVP上线功能清单' ||
    authority.range !== 'A1:F24' ||
    authority.selectionRange !== 'A3:F24' ||
    authority.sheets.mvp !== 22 ||
    authority.parserVersion !== 3 ||
    authority.generatorVersion !== 5 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(authority.reviewedAt)
  ) {
    throw new Error('REQUIREMENT_AUTHORITY_BASELINE_INVALID');
  }
  const expectedOrder = [
    '当前用户明确要求',
    'docs/福利商城功能清单.xlsx#MVP上线功能清单与接口',
    '../zhudatuan_li/docs/当前代码业务功能清单-20260904.md',
    '../zhudatuan_li/docs/zhudatuan-console-UX-acceptance-report-20260904.md',
    'zhudatuan当前合同模块数据库与质量门',
    'zhudatuan_li当前代码迁移来源',
  ];
  if (JSON.stringify(authority.authorityOrder) !== JSON.stringify(expectedOrder)) throw new Error('REQUIREMENT_AUTHORITY_ORDER_INVALID');
  const bytes = new Uint8Array(await readFile(path));
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== authority.sha256) {
    throw new Error('REQUIREMENT_AUTHORITY_HASH_INVALID:' + actualHash);
  }
  const architecturePaths = ['docs/architecture/福利商城理想方案20260904.md', 'docs/architecture/福利商城代码修改清单20260904.md'];
  if (document.architecture?.length !== architecturePaths.length || document.architecture.some((item, index) => item.repositoryRelativePath !== architecturePaths[index])) {
    throw new Error('ARCHITECTURE_AUTHORITY_INVALID');
  }
  for (const architecture of document.architecture) await verifyAuthority(repositoryRoot, architecture);
  const expectedOwners = Object.freeze({ approval: 'approval', vouchercredential: 'voucher', financeimport: 'finance', storeaudience: 'identity', supplieraudience: 'identity' });
  if (
    Object.keys(document.owners ?? {})
      .sort()
      .join(',') !== Object.keys(expectedOwners).sort().join(',')
  )
    throw new Error('ARCHITECTURE_OWNER_SET_INVALID');
  for (const [fact, module] of Object.entries(expectedOwners)) {
    const owner = document.owners?.[fact];
    if (owner?.module !== module) throw new Error(`ARCHITECTURE_OWNER_INVALID:${fact}`);
    assertRepositoryRelativePath(owner.authority);
    await realpath(resolve(repositoryRoot, owner.authority));
  }
  if (document.navigation?.version !== 3) throw new Error('ROUTE_CATALOG_VERSION_INVALID');
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
  const actual = createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
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
