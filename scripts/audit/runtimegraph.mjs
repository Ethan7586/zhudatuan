import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { auditDatabase } from '../check/callgraph/database.mjs';
import { auditJobs } from '../check/callgraph/jobs.mjs';
import { auditRoutes } from '../check/callgraph/routes.mjs';
import { root } from '../check/source.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

const context = graphContext();
const violations = [...auditJobs(context.sourceFiles, context.production), ...auditDatabase(context.production), ...auditRoutes(context.sourceFiles, context.production)];
const entries = ['ApiMain', 'JobsMain', 'MigrationMain', 'SmokeMain'];
for (const entry of entries) {
  const path = `services/commerce/src/app/${entry}.ts`;
  if (!existsSync(join(root, path))) violations.push({ code: 'RUNTIME_ENTRY_MISSING', location: path, detail: entry });
}
const obsoleteEntry = join(root, 'services/commerce/src/entry');
if (existsSync(obsoleteEntry) && readdirSync(obsoleteEntry).some((file) => file.endsWith('.ts')))
  violations.push({
    code: 'RUNTIME_ENTRY_DIRECTORY_FORBIDDEN',
    location: 'services/commerce/src/entry',
    detail: 'use app',
  });

const build = readFileSync(join(root, 'scripts/build-commerce.mjs'), 'utf8');
for (const entry of entries)
  if (!build.includes(`${entry}: 'services/commerce/src/app/${entry}.ts'`)) {
    violations.push({ code: 'RUNTIME_BUILD_ENTRY_MISSING', location: 'scripts/build-commerce.mjs', detail: entry });
  }
for (const forbidden of ['Registration', 'WebBusiness', 'Purchase', 'IdentityNotificationJobsOnly'])
  if (build.includes(forbidden)) {
    violations.push({ code: 'RUNTIME_TEMPORARY_ENTRY_FORBIDDEN', location: 'scripts/build-commerce.mjs', detail: forbidden });
  }

const api = readFileSync(join(root, 'services/commerce/src/app/ApiMain.ts'), 'utf8');
for (const token of ['bootstrapApi', 'assertRuntimeReady', 'listen('])
  if (!api.includes(token)) {
    violations.push({ code: 'API_BOOTSTRAP_EDGE_MISSING', location: 'services/commerce/src/app/ApiMain.ts', detail: token });
  }
if (api.indexOf('assertRuntimeReady') > api.indexOf('listen('))
  violations.push({
    code: 'API_READINESS_ORDER_INVALID',
    location: 'services/commerce/src/app/ApiMain.ts',
    detail: 'readiness before listen',
  });
const jobs = readFileSync(join(root, 'services/commerce/src/app/JobsMain.ts'), 'utf8');
for (const token of ['bootstrapJobs', 'JOB_RUNTIME_CATALOG_DRIFT', 'OutboxRelay', 'RuntimeScheduler'])
  if (!jobs.includes(token)) {
    violations.push({ code: 'JOBS_BOOTSTRAP_EDGE_MISSING', location: 'services/commerce/src/app/JobsMain.ts', detail: token });
  }
const pipeline = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationPipeline.ts'), 'utf8');
for (const token of ['operationSchema', 'policy.authorize', 'handlers.get', 'schema.output.parse'])
  if (!pipeline.includes(token)) {
    violations.push({ code: 'OPERATION_PIPELINE_EDGE_MISSING', location: 'services/commerce/src/foundation/application/OperationPipeline.ts', detail: token });
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
