import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { auditDatabase } from '../check/callgraph/database.mjs';
import { auditJobs } from '../check/callgraph/jobs.mjs';
import { auditRoutes } from '../check/callgraph/routes.mjs';
import { root } from '../check/source.mjs';
import { BUNDLED_ENTRY_POINTS, COMMERCE_ENTRY_POINTS } from '../lib/CommerceEntries.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

const context = graphContext();
const violations = [...auditJobs(context.sourceFiles, context.production), ...auditDatabase(context.production), ...auditRoutes(context.sourceFiles, context.production)];
for (const [entry, path] of Object.entries(COMMERCE_ENTRY_POINTS)) {
  if (!existsSync(join(root, path))) violations.push({ code: 'RUNTIME_ENTRY_MISSING', location: path, detail: entry });
}
const obsoleteEntry = join(root, 'services/commerce/src/app');
if (existsSync(obsoleteEntry) && readdirSync(obsoleteEntry).some((file) => file.endsWith('.ts')))
  violations.push({
    code: 'RUNTIME_ENTRY_DIRECTORY_FORBIDDEN',
    location: 'services/commerce/src/app',
    detail: 'use entry',
  });

const build = readFileSync(join(root, 'scripts/build-commerce.mjs'), 'utf8');
if (!build.includes("import { BUNDLED_ENTRY_POINTS } from './lib/CommerceEntries.mjs';") || !build.includes('entryPoints: BUNDLED_ENTRY_POINTS')) {
  violations.push({ code: 'RUNTIME_BUILD_CATALOG_MISSING', location: 'scripts/build-commerce.mjs', detail: 'BUNDLED_ENTRY_POINTS' });
}
const smoke = readFileSync(join(root, 'services/commerce/src/entry/SmokeMain.ts'), 'utf8');
for (const forbidden of ['insert into', 'update ', 'delete from', '.query(', 'seed'])
  if (smoke.toLowerCase().includes(forbidden)) violations.push({ code: 'SMOKE_BUSINESS_WRITE_FORBIDDEN', location: 'services/commerce/src/entry/SmokeMain.ts', detail: forbidden });
for (const forbidden of ['Registration', 'WebBusiness', 'Purchase', 'IdentityNotificationJobsOnly'])
  if (JSON.stringify(BUNDLED_ENTRY_POINTS).includes(forbidden)) {
    violations.push({ code: 'RUNTIME_TEMPORARY_ENTRY_FORBIDDEN', location: 'scripts/build-commerce.mjs', detail: forbidden });
  }

const api = readFileSync(join(root, 'services/commerce/src/entry/ApiMain.ts'), 'utf8');
for (const token of ['bootstrapApi', 'assertRuntimeReady', 'listen('])
  if (!api.includes(token)) {
    violations.push({ code: 'API_BOOTSTRAP_EDGE_MISSING', location: 'services/commerce/src/entry/ApiMain.ts', detail: token });
  }
if (api.indexOf('assertRuntimeReady') > api.indexOf('listen('))
  violations.push({
    code: 'API_READINESS_ORDER_INVALID',
    location: 'services/commerce/src/entry/ApiMain.ts',
    detail: 'readiness before listen',
  });
const jobs = readFileSync(join(root, 'services/commerce/src/entry/JobsMain.ts'), 'utf8');
for (const token of ['bootstrapJobs', 'JOB_RUNTIME_CATALOG_DRIFT', 'registries.workers.all'])
  if (!jobs.includes(token)) {
    violations.push({ code: 'JOBS_BOOTSTRAP_EDGE_MISSING', location: 'services/commerce/src/entry/JobsMain.ts', detail: token });
  }
const runtimeModule = readFileSync(join(root, 'services/commerce/src/modules/runtime/Module.ts'), 'utf8');
const runtimeWorkers = readFileSync(join(root, 'services/commerce/src/modules/runtime/infrastructure/queue/WorkerFactory.ts'), 'utf8');
const runtimeManifest = readFileSync(join(root, 'services/commerce/src/modules/runtime/Manifest.ts'), 'utf8');
if (!runtimeModule.includes('workers: createWorkers')) violations.push({ code: 'RUNTIME_WORKER_EDGE_MISSING', location: 'services/commerce/src/modules/runtime/Module.ts', detail: 'workers: createWorkers' });
for (const token of ['OutboxRelay', 'RuntimeScheduler'])
  if (!runtimeWorkers.includes(token)) violations.push({ code: 'RUNTIME_WORKER_EDGE_MISSING', location: 'services/commerce/src/modules/runtime/infrastructure/queue/WorkerFactory.ts', detail: token });
for (const token of ["workers: ['outboxrelay', 'scheduler']"]) if (!runtimeManifest.includes(token)) violations.push({ code: 'RUNTIME_WORKER_MANIFEST_MISSING', location: 'services/commerce/src/modules/runtime/Manifest.ts', detail: token });
const pipeline = readFileSync(join(root, 'services/commerce/src/pipeline/OperationPipeline.ts'), 'utf8');
for (const token of ['operationSchema', 'policy.authorize', 'handlers.get', 'schema.output.parse'])
  if (!pipeline.includes(token)) {
    violations.push({ code: 'OPERATION_PIPELINE_EDGE_MISSING', location: 'services/commerce/src/pipeline/OperationPipeline.ts', detail: token });
  }
const sdk = readFileSync(join(root, 'packages/sdk/src/ApiClient.ts'), 'utf8');
const httpContract = readFileSync(join(root, 'packages/contract/src/HttpContract.ts'), 'utf8');
if (!sdk.includes('[HttpHeader.contractVersion]: CONTRACT_VERSION') || !httpContract.includes("contractVersion: 'x-contract-version'"))
  violations.push({
    code: 'SDK_CONTRACT_HANDSHAKE_MISSING',
    location: 'packages/sdk/src/ApiClient.ts',
    detail: 'x-contract-version',
  });
report('runtime-graph', violations);
