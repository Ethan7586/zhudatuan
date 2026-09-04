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
  ['01_core_hexin/services/commerce/src/bootstrap/RuntimeCompatibility.ts', ['CONTRACT_CHECKSUM', 'runtime.schemaversion', 'runtime.operation', 'capability.operation', 'runtime.event', 'JOB_CATALOG', 'healthAll()']],
  ['01_core_hexin/services/commerce/src/entry/ApiMain.ts', ['assertRuntimeCompatibility', 'listen(']],
  ['01_core_hexin/services/commerce/src/entry/JobsMain.ts', ['JOB_RUNTIME_CATALOG_DRIFT', 'assertRuntimeCompatibility', 'registry.all()']],
  ['01_core_hexin/packages/sdk/src/ApiClient.ts', ["'x-contract-version': CONTRACT_VERSION"]],
  ['01_core_hexin/apps/miniapp/miniprogram/api/client.js', ["'x-contract-version': contract.version"]],
  ['01_core_hexin/services/commerce/src/foundation/interface/HttpApp.ts', ['CONTRACT_VERSION_UNSUPPORTED', '426']],
]);
for (const [file, tokens] of required) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const token of tokens) if (!source.includes(token)) violations.push({
    code: 'RUNTIME_COMPATIBILITY_EDGE_MISSING',
    location: file,
    detail: token,
  });
}
const api = readFileSync(join(root, '01_core_hexin/services/commerce/src/entry/ApiMain.ts'), 'utf8');
if (api.indexOf('assertRuntimeCompatibility') > api.indexOf('listen(')) violations.push({
  code: 'RUNTIME_COMPATIBILITY_ORDER_INVALID',
  location: '01_core_hexin/services/commerce/src/entry/ApiMain.ts',
  detail: 'compatibility must pass before listen',
});
report('runtime-graph', violations);
