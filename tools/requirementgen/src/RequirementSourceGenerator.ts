import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { strFromU8, unzipSync } from 'fflate';
import { stringify } from 'yaml';
import { loadRequirementAuthority } from './Authority';
import { loadRequirementSource } from './RequirementSource';
import { sharedStrings, worksheet } from './WorkbookReader';

const root = resolve(import.meta.dirname, '../../..');
const check = process.argv.includes('--check');
const { authority, bytes } = await loadRequirementAuthority(root);
const source = await loadRequirementSource(root);
const archive = unzipSync(bytes);
const shared = sharedStrings(xml('xl/sharedStrings.xml'));
const mvp = cells(findSheet('MVP上线功能清单'));
const providers = cells(findSheet('接口'));
for (const requirement of source.mvp) {
  if (requirement.release !== 'blocking') throw new Error(`MVP_RELEASE_DRIFT:${requirement.id}:${requirement.source.row}`);
}
for (const row of [11, 20]) {
  const definition = mvp.get(`D${row}`) ?? '';
  if (!definition.includes('分类销售数据') || definition.includes('粉类')) throw new Error(`MVP_REPORT_DIMENSION_DRIFT:${row}`);
}
if ([3, 4, 10, 19].some((row) => mvp.get(`F${row}`) !== '忽略')) throw new Error('MVP_HISTORICAL_IGNORE_DRIFT');
if ([9, 13, 18].some((row) => !(mvp.get(`F${row}`) ?? '').includes('待确认'))) throw new Error('MVP_HISTORICAL_NOTE_DRIFT');

const priorityOne = await Promise.all(
  source.providers.slice(0, 11).map(async (provider) => {
    const priority = Number(providers.get(`D${provider.row}`));
    const label = providers.get(`B${provider.row}`) ?? '';
    if (priority !== 1 || !label) throw new Error(`PROVIDER_PRIORITY_ONE_DRIFT:${provider.id}`);
    const definition = await providerDefinition(provider.id);
    if (definition.id !== provider.id || definition.name !== label) throw new Error(`PROVIDER_MANIFEST_NAME_DRIFT:${provider.id}`);
    return Object.freeze({ id: provider.id, row: provider.row, label, priority, core: provider.core, definition });
  })
);
if (source.providers.slice(11).some((provider) => Number(providers.get(`D${provider.row}`)) === 1)) throw new Error('PROVIDER_PRIORITY_ONE_COUNT_DRIFT');

const output = stringify(
  {
    generated: true,
    source: authority.logicalSource,
    workbookSha256: authority.sha256,
    authority: {
      path: authority.repositoryRelativePath,
      sheet: authority.sheet,
      sourceRange: authority.range,
      selectedRange: authority.selectionRange,
      sha256: authority.sha256,
      readAt: authority.reviewedAt,
      order: authority.authorityOrder,
      changePolicy: '工作簿内容或哈希变化时必须重新进行产品、架构、数据与发布评审',
    },
    counts: { mvp: 22, blocking: 22, providerRequired: 11 },
    mvp: source.mvp.map(({ id, title, source: reference, release }) => ({
      id,
      title,
      source: reference,
      release,
      historicalWorkbookNote: mvp.get(`F${reference.row}`) ?? '',
    })),
    providers: priorityOne.map(({ id, row, label, priority, core }) => ({ id, row, label, priority, core })),
  },
  { lineWidth: 0 }
);
await emit(resolve(root, 'docs/requirements/source.yml'), output);
await emit(
  resolve(root, 'config/providers.yml'),
  stringify(
    {
      version: 1,
      owner: 'extension',
      generated: true,
      source: 'docs/requirements/source.yml#providers+extensions/channel/*/Manifest.ts',
      workbookSha256: authority.sha256,
      providers: priorityOne.map(({ id, label, priority, core, definition }) => ({
        id,
        name: label,
        priority,
        extension: `extensions/channel/${id}`,
        package: `@shop/provider${id}`,
        factory: `${pascal(id)}Provider`,
        core,
        version: definition.version,
        apiVersion: definition.apiVersion,
        contractVersion: definition.contractVersion,
        dependencies: definition.dependencies.map((dependency) => ({ ...dependency, capabilities: [...dependency.capabilities] })),
        capabilities: [...definition.capabilities],
        permissions: [...definition.permissions],
        configSchema: definition.configSchema,
        secretRefs: [...definition.secretRefs],
        sandbox: { ...definition.sandbox },
        health: { operation: definition.healthOperation },
        rateLimit: { ...definition.rateLimits },
        timeout: { ...definition.timeout },
        retry: { ...definition.retryPolicy },
        circuit: { ...definition.circuitPolicy },
        webhook: { contract: definition.webhookContract, events: [...definition.eventSubscriptions] },
      })),
    },
    { lineWidth: 0 }
  ).replaceAll(/^(\s+package:) "([^"]+)"$/gm, "$1 '$2'")
);

interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly apiVersion: string;
  readonly contractVersion: string;
  readonly dependencies: readonly Readonly<{ id: string; version: string; capabilities: readonly string[] }>[];
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly configSchema: string;
  readonly secretRefs: readonly string[];
  readonly sandbox: Readonly<{ supported: true; mode: 'endpoint' | 'local'; endpointRef: string | null }>;
  readonly healthOperation: string;
  readonly rateLimits: Readonly<{ requestsPerSecond: number; maxConcurrency: number }>;
  readonly timeout: Readonly<{ connectionMs: number; responseMs: number; totalMs: number }>;
  readonly retryPolicy: Readonly<{ maxAttempts: number }>;
  readonly circuitPolicy: Readonly<{ failureThreshold: number; recoveryMs: number }>;
  readonly webhookContract: string | null;
  readonly eventSubscriptions: readonly string[];
}

async function providerDefinition(id: string): Promise<ProviderDefinition> {
  if (!/^[a-z][a-z0-9]*$/.test(id)) throw new Error(`PROVIDER_ID_INVALID:${id}`);
  const module = (await import(pathToFileURL(resolve(root, 'extensions/channel', id, 'Manifest.ts')).href)) as { readonly definition?: ProviderDefinition };
  if (!module.definition) throw new Error(`PROVIDER_MANIFEST_DEFINITION_MISSING:${id}`);
  return module.definition;
}

function cells(path: string): ReadonlyMap<string, string> {
  return worksheet(xml(path), shared);
}

function xml(path: string): string {
  const bytes = archive[path];
  if (bytes === undefined) throw new Error(`WORKBOOK_ENTRY_MISSING:${path}`);
  return strFromU8(bytes);
}

function findSheet(name: string): string {
  const workbook = xml('xl/workbook.xml');
  const relationship = new RegExp(`<sheet[^>]*name="${escapePattern(name)}"[^>]*r:id="([^"]+)"`).exec(workbook)?.[1];
  if (!relationship) throw new Error(`WORKBOOK_SHEET_MISSING:${name}`);
  const target = new RegExp(`<Relationship[^>]*Id="${escapePattern(relationship)}"[^>]*Target="([^"]+)"`).exec(xml('xl/_rels/workbook.xml.rels'))?.[1];
  if (!target) throw new Error(`WORKBOOK_SHEET_RELATION_MISSING:${name}`);
  return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
}

function pascal(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

async function emit(path: string, content: string): Promise<void> {
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error(`GENERATED_REQUIREMENT_SOURCE_DRIFT:${path}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
