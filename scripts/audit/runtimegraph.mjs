import { auditDatabase } from '../check/callgraph/database.mjs';
import { auditJobs } from '../check/callgraph/jobs.mjs';
import { auditRoutes } from '../check/callgraph/routes.mjs';
import { root } from '../check/source.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const context = graphContext();
const violations = [
  ...auditJobs(context.sourceFiles, context.production),
  ...auditDatabase(context.production),
  ...auditRoutes(context.sourceFiles, context.production),
];
const required = new Map([
  ['services/commerce/src/bootstrap/RuntimeCompatibility.ts', ['CONTRACT_CHECKSUM', 'runtime.schemaversion', 'runtime.operation', 'capability.operation', 'runtime.event', 'JOB_CATALOG', 'healthAll()']],
  ['services/commerce/src/entry/ApiMain.ts', ['assertRuntimeCompatibility', 'listen(']],
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  ['services/commerce/src/entry/JobsMain.ts', ['jobsEnvironment', 'runJobs']],
  ['services/commerce/src/entry/FullJobsMain.ts', ['JOB_RUNTIME_CATALOG_DRIFT', 'assertRuntimeCompatibility', 'registry.all()']],
  ['services/commerce/src/bootstrap/IdentityNotificationJobsRuntime.ts', ['identitynotification', 'assertIdentityNotificationRuntimeCompatibility']],
=======
  ['services/commerce/src/entry/JobsMain.ts', ['JOB_RUNTIME_CATALOG_DRIFT', 'assertRuntimeCompatibility', 'registry.all()']],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  ['services/commerce/src/entry/JobsMain.ts', ['jobsEnvironment', 'runJobs']],
  ['services/commerce/src/entry/FullJobsMain.ts', ['JOB_RUNTIME_CATALOG_DRIFT', 'assertRuntimeCompatibility', 'registry.all()']],
  ['services/commerce/src/bootstrap/IdentityNotificationJobsRuntime.ts', ['identitynotification', 'assertIdentityNotificationRuntimeCompatibility']],
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  ['services/commerce/src/entry/JobsMain.ts', ['JOB_RUNTIME_CATALOG_DRIFT', 'assertRuntimeCompatibility', 'registry.all()']],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  ['packages/sdk/src/ApiClient.ts', ["'x-contract-version': CONTRACT_VERSION"]],
  ['apps/miniapp/miniprogram/api/client.js', ["'x-contract-version': contract.version"]],
  ['services/commerce/src/foundation/interface/HttpApp.ts', ['CONTRACT_VERSION_UNSUPPORTED', '426']],
]);
for (const [file, tokens] of required) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const token of tokens) if (!source.includes(token)) violations.push({
    code: 'RUNTIME_COMPATIBILITY_EDGE_MISSING',
    location: file,
    detail: token,
  });
}
const api = readFileSync(join(root, 'services/commerce/src/entry/ApiMain.ts'), 'utf8');
if (api.indexOf('assertRuntimeCompatibility') > api.indexOf('listen(')) violations.push({
  code: 'RUNTIME_COMPATIBILITY_ORDER_INVALID',
  location: 'services/commerce/src/entry/ApiMain.ts',
  detail: 'compatibility must pass before listen',
});
report('runtime-graph', violations);
