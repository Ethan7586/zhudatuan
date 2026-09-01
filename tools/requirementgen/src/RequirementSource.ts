import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface SheetDefinition {
  readonly name: string;
  readonly label: string;
  readonly prefix: string;
  readonly rows: readonly number[];
  readonly level: string;
  readonly role: string;
  readonly scope: string;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly row: number;
  readonly core?: 'jdcore' | 'cakecore' | 'wanliancore' | 'tmallcore' | 'bookcore' | 'local';
}

export interface MvpDefinition {
  readonly id: `MVP${Uppercase<string>}`;
  readonly title: string;
  readonly source: Readonly<{
    sheet: 'MVP上线功能清单';
    row: number;
    range: string;
  }>;
  readonly status: 'Designed' | 'Implemented' | 'Integrated' | 'Accepted' | 'Released';
  readonly release: 'required' | 'nonblocking';
  readonly modules: readonly string[];
  readonly operations: readonly string[];
  readonly journeys: readonly string[];
  readonly providers: readonly string[];
  readonly clarifications: readonly string[];
  readonly runbook: string;
  readonly tables: readonly string[];
}

export interface ClarificationDefinition {
  readonly id: string;
  readonly requirements: readonly MvpDefinition['id'][];
  readonly term: string;
  readonly status: 'open' | 'resolved';
  readonly blocking: boolean;
  readonly owner: string;
  readonly acceptance: string | null;
  readonly resolvedby: string | null;
  readonly reason: string;
}

export interface RequirementBinding {
  readonly module: string;
  readonly operation: string;
  readonly route: string;
  readonly journey: string;
  readonly table: string;
}

export interface RequirementSource {
  readonly version: number;
  readonly sheets: readonly SheetDefinition[];
  readonly bindings: Readonly<Record<string, RequirementBinding>>;
  readonly providers: readonly ProviderDefinition[];
  readonly mvp: readonly MvpDefinition[];
  readonly clarifications: readonly ClarificationDefinition[];
}

interface SourceDocument {
  readonly version?: number;
  readonly sheets?: readonly SheetRecord[];
  readonly bindings?: Readonly<Record<string, RequirementBinding>>;
  readonly providers?: readonly ProviderDefinition[];
  readonly mvp?: readonly MvpDefinition[];
  readonly clarifications?: readonly ClarificationDefinition[];
}

interface SheetRecord extends Omit<SheetDefinition, 'rows'> {
  readonly rows?: readonly number[];
  readonly start?: number;
  readonly end?: number;
  readonly skip?: readonly number[];
}

export async function loadRequirementSource(root: string): Promise<RequirementSource> {
  const path = resolve(root, 'config/requirements.yml');
  const document = parse(await readFile(path, 'utf8')) as SourceDocument;
  if (document.version !== 4) throw new Error('REQUIREMENT_SOURCE_VERSION_INVALID:' + String(document.version));
  const sheets = Object.freeze((document.sheets ?? []).map(expandSheet));
  const bindings = Object.freeze({ ...(document.bindings ?? {}) });
  const providers = Object.freeze([...(document.providers ?? [])]);
  const mvp = Object.freeze([...(document.mvp ?? [])]);
  const clarifications = Object.freeze([...(document.clarifications ?? [])]);
  assertUnique(
    sheets.map(({ prefix }) => prefix),
    'REQUIREMENT_SHEET_PREFIX_DUPLICATE'
  );
  const expectedBindings = sheets.flatMap(({ prefix, rows }) => rows.map((_row, index) => prefix + String(index + 1).padStart(3, '0')));
  assertExactKeys(Object.keys(bindings), expectedBindings, 'REQUIREMENT_BINDING');
  for (const [id, binding] of Object.entries(bindings)) {
    if (!binding.module || !binding.operation || !binding.route.startsWith('/') || !binding.journey.endsWith('.spec.ts') || !binding.table.includes('.')) {
      throw new Error('REQUIREMENT_BINDING_INVALID:' + id);
    }
  }
  assertUnique(
    providers.map(({ id }) => id),
    'REQUIREMENT_PROVIDER_ID_DUPLICATE'
  );
  assertUnique(
    providers.map(({ row }) => String(row)),
    'REQUIREMENT_PROVIDER_ROW_DUPLICATE'
  );
  assertUnique(
    mvp.map(({ id }) => id),
    'MVP_ID_DUPLICATE'
  );
  if (mvp.length !== 22) throw new Error('MVP_SOURCE_COUNT_INVALID:' + mvp.length);
  if (mvp.some(({ id }) => !/^MVP[A-Z]+$/.test(id))) throw new Error('MVP_ID_INVALID');
  assertUnique(
    mvp.map(({ source }) => String(source.row)),
    'MVP_SOURCE_ROW_DUPLICATE'
  );
  assertUnique(
    mvp.flatMap(({ journeys }) => journeys),
    'MVP_JOURNEY_DUPLICATE'
  );
  if (mvp.some(({ source }) => source.sheet !== 'MVP上线功能清单' || source.row < 3 || source.row > 24 || source.range !== `A${source.row}:F${source.row}`)) {
    throw new Error('MVP_SOURCE_INVALID');
  }
  const mvpIds = new Set(mvp.map(({ id }) => id));
  const providerIds = new Set(providers.map(({ id }) => id));
  if (providers.slice(0, 11).some(({ core }) => core === undefined) || providers.slice(11).some(({ core }) => core !== undefined)) {
    throw new Error('REQUIREMENT_PROVIDER_CORE_INVALID');
  }
  const clarificationIds = new Set(clarifications.map(({ id }) => id));
  if (
    mvp.some(({ journeys, providers: references }) => journeys.length === 0 || references.some((reference) => !providerIds.has(reference))) ||
    clarifications.some(({ id, requirements, status }) => id.length === 0 || requirements.length === 0 || requirements.some((requirement) => !mvpIds.has(requirement)) || (status !== 'open' && status !== 'resolved')) ||
    mvp.some(({ clarifications: references }) => references.some((reference) => !clarificationIds.has(reference)))
  ) {
    throw new Error('REQUIREMENT_CLARIFICATION_INVALID');
  }
  return Object.freeze({ version: document.version, sheets, bindings, providers, mvp, clarifications });
}

function expandSheet(record: SheetRecord): SheetDefinition {
  const rows = record.rows ?? range(required(record.start, record.prefix + ':start'), required(record.end, record.prefix + ':end'));
  const skipped = new Set(record.skip ?? []);
  const selected = Object.freeze(rows.filter((row) => !skipped.has(row)));
  if (selected.length === 0) throw new Error('REQUIREMENT_SHEET_ROWS_EMPTY:' + record.prefix);
  return Object.freeze({
    name: record.name,
    label: record.label,
    prefix: record.prefix,
    rows: selected,
    level: record.level,
    role: record.role,
    scope: record.scope,
  });
}

function required(value: number | undefined, name: string): number {
  if (!Number.isInteger(value)) throw new Error('REQUIREMENT_SOURCE_FIELD_INVALID:' + name);
  return value!;
}

function range(start: number, end: number): readonly number[] {
  if (end < start) throw new Error('REQUIREMENT_SOURCE_RANGE_INVALID:' + start + ':' + end);
  return Object.freeze(Array.from({ length: end - start + 1 }, (_, index) => start + index));
}

function assertUnique(values: readonly string[], code: string): void {
  if (new Set(values).size !== values.length) throw new Error(code);
}

function assertExactKeys(actual: readonly string[], expected: readonly string[], code: string): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(code + '_KEYS_INVALID:missing=' + missing.join(',') + ':unexpected=' + unexpected.join(','));
  }
}
