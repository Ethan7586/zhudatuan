import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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
const nonblockingRows = new Set([3, 4, 10, 19]);

for (const requirement of source.mvp) {
  const note = mvp.get(`F${requirement.source.row}`) ?? '';
  const expectedRelease = nonblockingRows.has(requirement.source.row) ? 'nonblocking' : 'required';
  if (requirement.release !== expectedRelease) throw new Error(`MVP_RELEASE_DRIFT:${requirement.id}:${requirement.source.row}`);
  if (expectedRelease === 'nonblocking' && note !== '忽略') throw new Error(`MVP_NONBLOCKING_SOURCE_DRIFT:${requirement.id}`);
}
for (const row of [11, 20]) {
  const definition = mvp.get(`D${row}`) ?? '';
  if (!definition.includes('分类销售数据') || definition.includes('粉类')) throw new Error(`MVP_REPORT_DIMENSION_DRIFT:${row}`);
}
if (!(mvp.get('F9') ?? '').includes('待确认') || !(mvp.get('F18') ?? '').includes('待确认')) throw new Error('MVP_VOUCHER_CLARIFICATION_DRIFT');
if (!(mvp.get('F13') ?? '').includes('待确认')) throw new Error('MVP_RISK_CLARIFICATION_DRIFT');

const priorityOne = source.providers.slice(0, 11).map((provider) => {
  const priority = Number(providers.get(`D${provider.row}`));
  const label = providers.get(`B${provider.row}`) ?? '';
  if (priority !== 1 || !label) throw new Error(`PROVIDER_PRIORITY_ONE_DRIFT:${provider.id}`);
  return Object.freeze({ id: provider.id, row: provider.row, label, priority, core: provider.core });
});
if (source.providers.slice(11).some((provider) => Number(providers.get(`D${provider.row}`)) === 1)) throw new Error('PROVIDER_PRIORITY_ONE_COUNT_DRIFT');

const output = stringify(
  {
    generated: true,
    source: authority.logicalSource,
    workbookSha256: authority.sha256,
    counts: { mvp: 22, required: 18, nonblocking: 4, providerRequired: 11 },
    mvp: source.mvp.map(({ id, title, source: reference, release, clarifications }) => ({ id, title, source: reference, release, clarifications })),
    providers: priorityOne,
    clarifications: source.clarifications,
  },
  { lineWidth: 0 }
);
await emit(resolve(root, 'docs/requirements/source.yml'), output);
await emit(
  resolve(root, 'config/providers.yml'),
  stringify(
    {
      generated: true,
      source: 'docs/requirements/source.yml#providers',
      workbookSha256: authority.sha256,
      providers: priorityOne.map(({ id, label, priority, core }) => ({ id, label, priority, extension: `extensions/channel/${id}`, package: `@shop/provider${id}`, factory: `${pascal(id)}Provider`, core })),
    },
    { lineWidth: 0 }
  ).replaceAll(/^(\s+package:) "([^"]+)"$/gm, "$1 '$2'")
);

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
