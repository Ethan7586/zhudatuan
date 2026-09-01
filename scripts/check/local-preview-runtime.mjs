import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const BASE_COMMIT = process.env.PRODUCT_PREVIEW_BASE_COMMIT ?? '0db535e2475c017dda8bb055344a240f6e2ae1b9';
const EXPECTED_BRANCH = process.env.PRODUCT_PREVIEW_BRANCH ?? 'codex/product-000a-baseline-isolation';
const CONSOLE_ORIGIN = process.env.PRODUCT_PREVIEW_CONSOLE_ORIGIN ?? 'http://127.0.0.1:5274';
const AUTH_ORIGIN = process.env.PRODUCT_PREVIEW_AUTH_ORIGIN ?? 'http://127.0.0.1:5275';
const API_ORIGIN = process.env.PRODUCT_PREVIEW_API_ORIGIN ?? 'http://127.0.0.1:3211';
const { values } = parseArgs({
  options: {
    'source-only': { type: 'boolean', default: false },
    'candidate-root': { type: 'string' },
    'print-attribution': { type: 'boolean', default: false },
    'prepare-runtime-config': { type: 'boolean', default: false },
  },
});
const errors = [];

if (values['prepare-runtime-config']) prepareRuntimeConfig();

const branch = git(ROOT, ['branch', '--show-current']) || '(detached)';
const head = git(ROOT, ['rev-parse', 'HEAD']);
const baseIsAncestor = result('git', ['-C', ROOT, 'merge-base', '--is-ancestor', BASE_COMMIT, head]).status === 0;
const dirty = statusRecords(ROOT);

console.log(`root=${ROOT}`);
console.log(`branch=${branch}`);
console.log(`head=${head}`);
console.log(`base=${BASE_COMMIT}`);
console.log(`dirty_files=${dirty.length}`);
if (branch !== EXPECTED_BRANCH) errors.push(`BRANCH_MISMATCH:expected=${EXPECTED_BRANCH}:actual=${branch}`);
if (!baseIsAncestor) errors.push(`BASE_NOT_ANCESTOR:${BASE_COMMIT}:${head}`);
validateDirtyFiles(dirty);
validateLockfile();
validateMigrationLedger(dirty, head);

if (values['candidate-root']) attributeCandidate(real(values['candidate-root']), values['print-attribution']);
if (!values['source-only']) await validateServices();

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error('result=FAIL');
  process.exitCode = 1;
} else {
  console.log('result=PASS');
}

function validateDirtyFiles(records) {
  const allowed = new Set([
    'apps/console/vite.config.ts',
    'apps/console/src/shared/config/BuildInfo.ts',
    'apps/console/src/shared/config/BuildInfo.test.ts',
    'apps/console/src/shell/ScopeShell.tsx',
    'apps/console/src/shell/ScopeShell.test.tsx',
    'scripts/check/local-preview-database.mjs',
    'scripts/check/local-preview-runtime.mjs',
    'docs/本地预览唯一版本说明.md',
  ]);
  for (const record of records) if (!allowed.has(record.path)) errors.push(`UNATTRIBUTED_DIRTY_FILE:${record.path}`);
}

function validateLockfile() {
  const candidates = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
  const present = candidates.filter((name) => existsSync(resolve(ROOT, name)));
  console.log(`lockfiles=${present.join(',') || '(none)'}`);
  if (present.length !== 1 || present[0] !== 'package-lock.json') errors.push(`LOCKFILE_NOT_UNIQUE:${present.join(',')}`);
  if (present[0] === 'package-lock.json') {
    const lock = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json'), 'utf8'));
    if (lock.lockfileVersion !== 3) errors.push(`PACKAGE_LOCK_VERSION_INVALID:${String(lock.lockfileVersion)}`);
  }
}

function prepareRuntimeConfig() {
  const secretsPath = resolve(ROOT, 'infrastructure/local/secrets.local.json');
  const database = process.env.PRODUCT_PREVIEW_DATABASE_NAME ?? 'shop';
  const port = process.env.PRODUCT_PREVIEW_DATABASE_PORT ?? '55490';
  if (!existsSync(secretsPath)) throw new Error('LOCAL_SECRETS_NOT_PREPARED');
  const catalog = JSON.parse(readFileSync(secretsPath, 'utf8'));
  let updated = 0;
  for (const [key, value] of Object.entries(catalog)) {
    if (!key.startsWith('shop/local/database/') || typeof value !== 'string') continue;
    const endpoint = new URL(value);
    endpoint.hostname = '127.0.0.1';
    endpoint.port = port;
    endpoint.pathname = `/${database}`;
    catalog[key] = endpoint.toString();
    updated += 1;
  }
  if (updated !== 4) throw new Error(`LOCAL_DATABASE_REFS_INCOMPLETE:${updated}`);
  writeFileSync(secretsPath, `${JSON.stringify(catalog, null, 2)}\n`, { mode: 0o600 });
  chmodSync(secretsPath, 0o600);
  console.log(`runtime_config=prepared database=${database} port=${port} refs=${updated}`);
}

function validateMigrationLedger(records, head) {
  const committed = git(ROOT, ['diff', '--name-only', `${BASE_COMMIT}..${head}`])
    .split('\n')
    .filter(Boolean);
  const paths = new Set([...committed, ...records.map(({ path }) => path)]);
  const mutation = /\b(?:update|delete\s+from|insert\s+into)\s+runtime\.schemaversion\b/i;
  for (const path of paths) {
    if (!path.startsWith('database/supabase/migrations/') || !path.endsWith('.sql')) continue;
    const absolute = resolve(ROOT, path);
    if (existsSync(absolute) && mutation.test(readFileSync(absolute, 'utf8'))) errors.push(`MIGRATION_LEDGER_MUTATION:${path}`);
  }
}

function attributeCandidate(candidateRoot, printAttribution) {
  const raw = gitRaw(candidateRoot, ['-c', 'core.quotePath=false', 'status', '--porcelain=v1']);
  const digest = createHash('sha256').update(raw).digest('hex');
  const expectedDigest = process.env.PRODUCT_PREVIEW_CANDIDATE_STATUS_SHA256;
  const records = raw
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
  const summary = new Map();
  for (const record of records) {
    const owner = candidateOwner(record.path);
    summary.set(owner, (summary.get(owner) ?? 0) + 1);
    if (owner === 'UNASSIGNED') errors.push(`CANDIDATE_FILE_UNASSIGNED:${record.path}`);
    if (printAttribution) console.log(`candidate\t${record.status}\t${owner}\t${record.path}`);
  }
  console.log(`candidate_root=${candidateRoot}`);
  console.log(`candidate_files=${records.length}`);
  console.log(`candidate_status_sha256=${digest}`);
  console.log(
    `candidate_attribution=${[...summary]
      .sort()
      .map(([owner, count]) => `${owner}:${count}`)
      .join(',')}`
  );
  if (expectedDigest && digest !== expectedDigest) errors.push(`CANDIDATE_STATUS_CHANGED:expected=${expectedDigest}:actual=${digest}`);
}

function candidateOwner(path) {
  if (path.startsWith('apps/auth-web/')) return 'EXCLUDED-LOGIN';
  if (/Payment|payment/i.test(path) && (path.startsWith('extensions/providers/core/') || path.startsWith('packages/contract/src/provider/'))) {
    return 'EXCLUDED-PAYMENT';
  }
  if (path.startsWith('packages/design/')) return 'PRODUCT-013-APPROVAL-REQUIRED';
  if (path === 'pnpm-lock.yaml' || path === 'package-lock.json' || path === 'packages/config/src/Release.ts' || path.startsWith('scripts/check/local-preview-') || path === 'docs/本地预览唯一版本说明.md') return 'PRODUCT-000A';
  if (path === 'scripts/audit/database-contracts.mjs' || path.endsWith('/RegistrationMigrationRunner.ts')) return 'PRODUCT-000R';
  if (path.startsWith('database/supabase/migrations/')) return 'PRODUCT-000R-MIGRATION';
  if (path.startsWith('database/contracts/') || path === 'docs/requirements/mvp.yml') return 'PRODUCT-014';
  if (path.startsWith('apps/console/public/product-preview/')) return 'PRODUCT-002-REMOVE-PREVIEW';
  if (path.startsWith('apps/console/')) return consoleOwner(path);
  if (path.startsWith('extensions/providers/')) return 'PRODUCT-005';
  if (path.startsWith('packages/sdk/') || path.startsWith('tools/contractgen/')) return 'PRODUCT-005-SERIAL-GENERATED';
  if (path.startsWith('packages/contract/')) return contractOwner(path);
  if (path === 'scripts/build-web-tokens.mjs') return 'PRODUCT-013';
  if (path.includes('/callgraph/events.mjs')) return 'PRODUCT-008';
  if (path.includes('/callgraph/extensions.mjs')) return 'PRODUCT-005';
  if (path.startsWith('services/commerce/src/modules/extension/') || path.startsWith('services/commerce/src/bootstrap/Extension') || path.endsWith('/ProviderFactories.ts') || path.endsWith('/ProviderLoader.ts')) return 'PRODUCT-005';
  if (path.startsWith('services/commerce/src/modules/channel/')) return channelOwner(path);
  if (path.startsWith('services/commerce/src/modules/reporting/')) {
    return /ProjectEvent|ReportingPort|PgReportingRepository/.test(path) ? 'PRODUCT-008' : 'PRODUCT-001';
  }
  if (
    path.startsWith('services/commerce/src/modules/catalog/') ||
    path.startsWith('services/commerce/src/modules/inventory/') ||
    path.startsWith('services/commerce/src/modules/pricing/') ||
    path.endsWith('/OwnedEventInbox.ts') ||
    path.endsWith('/app/events.ts') ||
    path.endsWith('/app/jobs.ts')
  )
    return 'PRODUCT-008';
  if (path.endsWith('/OperationHandler.ts') || path.endsWith('/OperationController.ts')) return 'PRODUCT-005-SERIAL-INTEGRATION';
  if (path.startsWith('tools/seed/')) return 'PRODUCT-004';
  return 'UNASSIGNED';
}

function consoleOwner(path) {
  if (/ProductDrawer|ProductWorkspaceDetail/.test(path)) return 'PRODUCT-003';
  if (/ProductSchema/.test(path)) return 'PRODUCT-001';
  if (/ProductConnectionForm/.test(path)) return 'PRODUCT-005';
  if (/ProductSupplyQuery/.test(path)) return 'PRODUCT-008';
  if (/ProductSupply|product-supply|product-lock-v12/.test(path)) return 'PRODUCT-013';
  return 'PRODUCT-002';
}

function contractOwner(path) {
  if (/Payment|payment/.test(path)) return 'EXCLUDED-PAYMENT';
  if (/ProviderRecord/.test(path)) return 'PRODUCT-007';
  if (/events|EventSerializer|CommerceEvents/.test(path)) return 'PRODUCT-008-SERIAL-CONTRACT';
  return 'PRODUCT-005-SERIAL-CONTRACT';
}

function channelOwner(path) {
  if (/EnableConnection/.test(path)) return 'PRODUCT-006';
  if (/RunSync|SyncRun|ChannelSync|GetSyncRuns|providerrecord/i.test(path)) return 'PRODUCT-007';
  if (/CreateConnection|GetConnections|ConnectionProjection/.test(path)) return 'PRODUCT-005';
  return 'PRODUCT-007-SERIAL-INTEGRATION';
}

async function validateServices() {
  const services = [
    { name: 'commerce-api', origin: API_ORIGIN, cwd: ROOT, kind: 'api' },
    { name: 'console', origin: CONSOLE_ORIGIN, cwd: resolve(ROOT, 'apps/console'), kind: 'web' },
    { name: 'auth-web', origin: AUTH_ORIGIN, cwd: resolve(ROOT, 'apps/auth-web'), kind: 'web' },
  ];
  const apiState = await fetchApi(`${API_ORIGIN}/health/ready`, 'commerce-api');
  for (const service of services) {
    const port = Number(new URL(service.origin).port);
    const pid = listener(port);
    if (!pid) {
      errors.push(`EXPECTED_PORT_MISSING:${service.name}:${port}`);
      continue;
    }
    const cwd = processCwd(pid);
    const commandLine = command('ps', ['-p', pid, '-o', 'command=']);
    console.log(`service=${service.name} port=${port} pid=${pid} cwd=${cwd ?? '(unknown)'} command=${commandLine.slice(0, 160)}`);
    if (cwd !== service.cwd) errors.push(`WORKTREE_MISMATCH:${service.name}:expected=${service.cwd}:actual=${cwd ?? '(unknown)'}`);
    if (cwd && git(cwd, ['rev-parse', 'HEAD']) !== head) errors.push(`SERVICE_HEAD_MISMATCH:${service.name}`);
    if (service.kind === 'web') await fetchHtml(service.origin, service.name);
  }
  const proxied = await fetchApi(`${CONSOLE_ORIGIN}/api/health/ready`, 'console-proxy');
  if (apiState?.schema?.version !== proxied?.schema?.version || apiState?.contract?.checksum !== proxied?.contract?.checksum) {
    errors.push('CONSOLE_API_SOURCE_MISMATCH');
  }
}

async function fetchApi(url, name) {
  try {
    const response = await fetch(url, { headers: { 'x-contract-version': '1.0.0' }, redirect: 'manual' });
    const body = await response.json().catch(() => undefined);
    console.log(`health=${name} status=${response.status}`);
    if (!response.ok) errors.push(`HEALTH_NOT_READY:${name}:${response.status}`);
    if (!body || typeof body !== 'object' || !('schema' in body) || !('contract' in body) || !('registries' in body) || !('database' in body)) {
      errors.push(`HEALTH_NOT_CANONICAL_API:${name}`);
      return undefined;
    }
    return body;
  } catch (cause) {
    errors.push(`HEALTH_UNREACHABLE:${name}:${String(cause)}`);
    return undefined;
  }
}

async function fetchHtml(origin, name) {
  try {
    const response = await fetch(origin, { redirect: 'manual' });
    const type = response.headers.get('content-type') ?? '';
    console.log(`web=${name} status=${response.status} content_type=${type}`);
    if (!response.ok || !type.includes('text/html')) errors.push(`WEB_NOT_READY:${name}:${response.status}:${type}`);
  } catch (cause) {
    errors.push(`WEB_UNREACHABLE:${name}:${String(cause)}`);
  }
}

function listener(port) {
  return commandOptional('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'])
    .split('\n')
    .find(Boolean);
}

function processCwd(pid) {
  return commandOptional('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'])
    .split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1);
}

function statusRecords(root) {
  return gitRaw(root, ['-c', 'core.quotePath=false', 'status', '--porcelain=v1'])
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
}

function git(root, arguments_) {
  return command('git', ['-C', root, ...arguments_]);
}

function gitRaw(root, arguments_) {
  return execFileSync('git', ['-C', root, ...arguments_], { encoding: 'utf8' });
}

function command(name, arguments_) {
  return execFileSync(name, arguments_, { encoding: 'utf8' }).trim();
}

function commandOptional(name, arguments_) {
  const executed = result(name, arguments_);
  if (executed.status === 0) return executed.stdout.trim();
  if (executed.status === 1) return '';
  throw new Error(`COMMAND_FAILED:${name}:${executed.status}:${executed.stderr.trim()}`);
}

function result(name, arguments_) {
  return spawnSync(name, arguments_, { encoding: 'utf8' });
}

function real(path) {
  try {
    return realpathSync(path);
  } catch {
    throw new Error(`PATH_NOT_FOUND:${path}`);
  }
}
