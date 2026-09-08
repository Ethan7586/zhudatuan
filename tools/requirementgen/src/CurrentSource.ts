import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';

export const CURRENT_SOURCE_STATUSES = Object.freeze(['已开放', '\u90e8\u5206\u5f00\u653e', '后台具备', '自动执行', '仅设计', '占位'] as const);
export type CurrentSourceStatus = (typeof CURRENT_SOURCE_STATUSES)[number];
export type CurrentDisposition = 'Retained' | 'Completed' | 'Connected' | 'Unified' | 'Implemented' | 'Replaced';

export interface CurrentFunctionRow {
  readonly id: `LI${string}`;
  readonly line: number;
  readonly section: string;
  readonly heading: string;
  readonly sourceStatus: CurrentSourceStatus;
  readonly qualifier: string | null;
  readonly text: string;
}

export interface FusionProfile {
  readonly modules: readonly string[];
  readonly routes: readonly string[];
  readonly operationRoots: readonly string[];
  readonly journeys: readonly `J${number}`[];
  readonly jobs?: readonly string[] | 'all';
}

export interface FusionConfig {
  readonly version: number;
  readonly authority: 'currentFunctions';
  readonly source: Readonly<{ path: string; sha256: string; commit: string; count: number; snapshot: string; trace: string }>;
  readonly statusCounts: Readonly<Record<CurrentSourceStatus, number>>;
  readonly dispositions: Readonly<Record<CurrentSourceStatus, CurrentDisposition>>;
  readonly providerAliases: Readonly<Record<string, string>>;
  readonly primaryOperations: Readonly<Record<string, string>>;
  readonly sections: Readonly<Record<string, FusionProfile>>;
  readonly overrides: Readonly<Record<string, FusionProfile>>;
}

export interface CurrentFunctionSource {
  readonly schema: 'zhudatuan.current-functions.v1';
  readonly generated: true;
  readonly importedAt: string;
  readonly source: Readonly<{ path: string; sha256: string; commit: string }>;
  readonly count: number;
  readonly statusCounts: Readonly<Record<CurrentSourceStatus, number>>;
  readonly sectionCounts: Readonly<Record<string, number>>;
  readonly rows: readonly CurrentFunctionRow[];
}

export async function loadFusionConfig(root: string): Promise<FusionConfig> {
  const [fusionSource, authoritySource] = await Promise.all([readFile(resolve(root, 'config/fusion.yml'), 'utf8'), readFile(resolve(root, 'config/authorities.yml'), 'utf8')]);
  const raw = parse(fusionSource) as Omit<FusionConfig, 'source'>;
  const authority = (parse(authoritySource) as { readonly currentFunctions?: CurrentFunctionAuthority }).currentFunctions;
  if (raw.authority !== 'currentFunctions' || !authority) throw new Error('CURRENT_FUNCTION_AUTHORITY_MISSING');
  const document: FusionConfig = Object.freeze({
    ...raw,
    source: Object.freeze({
      path: authority.sourcePath,
      sha256: authority.sourceSha256,
      commit: authority.sourceCommit,
      count: authority.count,
      snapshot: authority.snapshot,
      trace: authority.trace,
    }),
  });
  if (document.version !== 1 || document.source.count !== 462 || !/^[a-f0-9]{64}$/.test(document.source.sha256)) throw new Error('CURRENT_FUNCTION_CONFIG_INVALID');
  if (!document.source.path.startsWith('../zhudatuan_li/') || !document.source.snapshot.startsWith('docs/requirements/') || !document.source.trace.startsWith('docs/requirements/')) {
    throw new Error('CURRENT_FUNCTION_SOURCE_PATH_INVALID');
  }
  const dispositionValues = new Set(Object.values(document.dispositions));
  if (dispositionValues.size !== CURRENT_SOURCE_STATUSES.length) throw new Error('CURRENT_FUNCTION_DISPOSITION_INVALID');
  for (const status of CURRENT_SOURCE_STATUSES) {
    if (!Number.isInteger(document.statusCounts[status]) || document.statusCounts[status] < 1 || !document.dispositions[status]) throw new Error('CURRENT_FUNCTION_STATUS_CONFIG_INVALID:' + status);
  }
  return Object.freeze(document);
}

interface CurrentFunctionAuthority {
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly sourceCommit: string;
  readonly snapshot: string;
  readonly trace: string;
  readonly count: number;
}

export async function loadCurrentFunctionSource(root: string): Promise<Readonly<{ config: FusionConfig; source: CurrentFunctionSource }>> {
  const config = await loadFusionConfig(root);
  const source = parse(await readFile(resolve(root, config.source.snapshot), 'utf8')) as CurrentFunctionSource;
  validateSource(source, config);
  const external = resolve(root, config.source.path);
  if (await exists(external)) {
    const bytes = await readFile(external);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== config.source.sha256) throw new Error('CURRENT_FUNCTION_EXTERNAL_HASH_INVALID:' + hash);
    if (JSON.stringify(parseCurrentFunctionMarkdown(bytes.toString('utf8'))) !== JSON.stringify(source.rows)) throw new Error('CURRENT_FUNCTION_EXTERNAL_DRIFT');
  }
  return Object.freeze({ config, source: Object.freeze(source) });
}

export async function importCurrentFunctionSource(root: string): Promise<Readonly<{ path: string; content: string }>> {
  const config = await loadFusionConfig(root);
  const bytes = await readFile(resolve(root, config.source.path));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== config.source.sha256) throw new Error('CURRENT_FUNCTION_IMPORT_HASH_INVALID:' + hash);
  const rows = parseCurrentFunctionMarkdown(bytes.toString('utf8'));
  const document: CurrentFunctionSource = Object.freeze({
    schema: 'zhudatuan.current-functions.v1',
    generated: true,
    importedAt: '2026-09-08',
    source: Object.freeze({ path: config.source.path, sha256: hash, commit: config.source.commit }),
    count: rows.length,
    statusCounts: counts(rows, ({ sourceStatus }) => sourceStatus) as Record<CurrentSourceStatus, number>,
    sectionCounts: counts(rows, ({ section }) => section),
    rows,
  });
  validateSource(document, config);
  return Object.freeze({ path: config.source.snapshot, content: stringify(document, { lineWidth: 0 }) });
}

export function parseCurrentFunctionMarkdown(source: string): readonly CurrentFunctionRow[] {
  const rows: CurrentFunctionRow[] = [];
  let section = '';
  let heading = '';
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const title = line.match(/^### (\d+\.\d+) (.+)$/) ?? line.match(/^## (\d+)\.?(?:\s+)(.+)$/);
    if (title) [section, heading] = [title[1]!, title[2]!];
    const value = line.match(/^- \*\*(已开放|\u90e8\u5206\u5f00\u653e|后台具备|自动执行|仅设计|占位)(?:｜([^*]+))?\*\*：(.+)$/);
    if (!value) continue;
    if (!section || !heading) throw new Error('CURRENT_FUNCTION_HEADING_MISSING:' + (index + 1));
    rows.push(
      Object.freeze({
        id: `LI${String(rows.length + 1).padStart(4, '0')}`,
        line: index + 1,
        section,
        heading,
        sourceStatus: value[1] as CurrentSourceStatus,
        qualifier: value[2] ?? null,
        text: value[3]!.trim(),
      })
    );
  }
  return Object.freeze(rows);
}

function validateSource(source: CurrentFunctionSource, config: FusionConfig): void {
  if (source.schema !== 'zhudatuan.current-functions.v1' || source.generated !== true || source.source.path !== config.source.path || source.source.sha256 !== config.source.sha256 || source.source.commit !== config.source.commit) {
    throw new Error('CURRENT_FUNCTION_SNAPSHOT_AUTHORITY_INVALID');
  }
  if (source.count !== config.source.count || source.rows.length !== source.count) throw new Error('CURRENT_FUNCTION_COUNT_INVALID:' + source.rows.length);
  for (const status of CURRENT_SOURCE_STATUSES) {
    if (source.statusCounts[status] !== config.statusCounts[status]) throw new Error('CURRENT_FUNCTION_STATUS_COUNT_INVALID:' + status);
  }
  const ids = new Set<string>();
  let previousLine = 0;
  for (const [index, row] of source.rows.entries()) {
    if (row.id !== `LI${String(index + 1).padStart(4, '0')}` || ids.has(row.id)) throw new Error('CURRENT_FUNCTION_ID_INVALID:' + row.id);
    if (!CURRENT_SOURCE_STATUSES.includes(row.sourceStatus) || !row.section || !row.heading || !row.text || row.line <= previousLine) throw new Error('CURRENT_FUNCTION_ROW_INVALID:' + row.id);
    ids.add(row.id);
    previousLine = row.line;
  }
  const sections = new Set(source.rows.map(({ section }) => section));
  if (JSON.stringify([...sections].sort()) !== JSON.stringify(Object.keys(config.sections).sort())) throw new Error('CURRENT_FUNCTION_SECTION_COVERAGE_INVALID');
  for (const id of Object.keys(config.overrides)) if (!ids.has(id)) throw new Error('CURRENT_FUNCTION_OVERRIDE_UNKNOWN:' + id);
  for (const id of Object.keys(config.primaryOperations)) if (!ids.has(id)) throw new Error('CURRENT_FUNCTION_PRIMARY_UNKNOWN:' + id);
  for (const [qualifier] of Object.entries(config.providerAliases)) {
    if (!source.rows.some((row) => row.qualifier === qualifier)) throw new Error('CURRENT_FUNCTION_PROVIDER_ALIAS_UNUSED:' + qualifier);
  }
}

function counts<T extends string>(rows: readonly CurrentFunctionRow[], select: (row: CurrentFunctionRow) => T): Record<T, number> {
  const result = {} as Record<T, number>;
  for (const row of rows) {
    const key = select(row);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false);
}
