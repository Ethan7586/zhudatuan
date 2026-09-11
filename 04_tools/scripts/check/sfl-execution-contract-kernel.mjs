import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const paths = Object.freeze({
  openapi: '01_core_hexin/packages/contract/openapi.json',
  operations: '01_core_hexin/packages/contract/definitions/operations.yml',
  kernel: '01_core_hexin/services/commerce/src/foundation/application/ExecutionKernel.ts',
  moduleOperations: '01_core_hexin/services/commerce/src/foundation/application/ModuleOperations.ts',
  handler: '01_core_hexin/services/commerce/src/foundation/application/OperationHandler.ts',
  migration: '02_platform_pingtai/database/supabase/migrations/20260912170000_create_sfl_execution_contract_kernel.sql',
  evidence: '05_docs_ziliao/docs_wendang/architecture/evidence/SFL-2.2-关键写执行合同矩阵-2026-09-12.json',
});
const dimensions = ['transaction_entry', 'idempotency', 'state_machine', 'outbox', 'business_number', 'audit', 'contract_schema', 'sdk', 'bypass', 'operation_hash'];

const [openapi, definitions, kernel, moduleOperations, handler, migration] = await Promise.all([
  json(paths.openapi), text(paths.operations), text(paths.kernel), text(paths.moduleOperations), text(paths.handler), text(paths.migration),
]);
const operationDefinitions = Object.values(openapi.paths).flatMap((path) => Object.values(path));
const writes = operationDefinitions.filter((operation) => operation['x-write-path'] !== 'none');
const rows = await Promise.all(writes.map(auditOperation));
const runtime = rows.filter((row) => row.availability === 'runtime');
const statusCounts = countStatuses(runtime);
const artifact = Object.freeze({
  standard: 'SFL 2.2 §9-§10',
  generated_at: '2026-09-12',
  source_of_truth: paths.operations,
  inventory: Object.freeze({ definitions: operationDefinitions.length, critical_writes: rows.length,
    runtime_critical_writes: runtime.length, frozen_critical_writes: rows.length - runtime.length }),
  runtime_status_counts: statusCounts,
  rows,
});

if (process.argv.includes('--write')) await writeFile(resolve(root, paths.evidence), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ inventory: artifact.inventory, runtime_status_counts: statusCounts }, null, 2));
if (Object.values(statusCounts).some((counts) => counts.FAIL > 0 || counts.UNKNOWN > 0)) process.exitCode = 1;

async function auditOperation(operation) {
  const id = operation.operationId;
  const domain = id.split('.')[0];
  const requestSchema = openapi.components.schemas[operation['x-request-schema']];
  const responseSchema = openapi.components.schemas[operation['x-response-schema']];
  const sdkPath = `01_core_hexin/packages/sdk/src/operations/${domain}.ts`;
  const sdk = await text(sdkPath);
  const commonEvidence = Object.freeze([paths.operations, paths.openapi]);
  const row = {
    operation_id: id,
    availability: operation['x-availability'],
    owner: domain,
    write_path: operation['x-write-path'],
    handler: paths.handler,
    transaction_entry: dimension(
      (operation['x-write-path'] === 'transactional' && moduleOperations.includes('this.kernel.execute'))
        || (operation['x-write-path'] === 'durable' && durableSource(id) !== null)
        || (operation['x-write-path'] === 'provider' && id === 'payment.webhooks.wechat'),
      [paths.moduleOperations, paths.kernel, ...(durableSource(id) ? [durableSource(id)] : [])],
    ),
    idempotency: operation['x-write-path'] === 'provider'
      ? dimension('N/A', commonEvidence)
      : dimension(operation['x-idempotency'] === 'required'
        && operation['x-idempotency-scope'] === 'operation+realm+node+membership+business-key', [paths.kernel, paths.migration, paths.openapi]),
    state_machine: dimension(typeof operation['x-state-machine'] === 'string'
      && operation['x-state-machine'].endsWith('.execution.v1'), [paths.kernel, paths.migration, paths.openapi]),
    outbox: dimension(kernel.includes("'runtime.operation.completed'") && migration.includes('runtime.operation.completed'),
      [paths.kernel, paths.migration]),
    business_number: dimension(/^SFL-[A-Z0-9]+-\{sha256:16\}$/.test(operation['x-business-number'] ?? ''),
      [paths.kernel, paths.migration, paths.openapi]),
    audit: dimension(kernel.includes('this.writeAudit') && moduleOperations.includes('appendOperationAudit'), [paths.kernel, paths.moduleOperations]),
    contract_schema: dimension(operation['x-schema-fidelity'] === 'named'
      && requestSchema?.additionalProperties === false
      && (operation['x-response-mode'] === 'empty' || responseSchema?.additionalProperties === false),
      [paths.operations, paths.openapi]),
    sdk: dimension(sdk.includes(`"${id}"`) && sdk.includes('defineContractOperation'), [sdkPath, paths.openapi]),
    bypass: dimension(handler.includes('assertEnforcedWriteResult'), [paths.handler, paths.kernel]),
    operation_hash: dimension(/^[a-f0-9]{64}$/.test(operation['x-operation-hash'] ?? ''), commonEvidence),
  };
  if (row.availability !== 'runtime') {
    for (const name of dimensions) row[name] = dimension('N/A', row[name].evidence);
  }
  return Object.freeze(row);
}

function durableSource(id) {
  if (id.startsWith('identity.wechat.')) return '01_core_hexin/services/commerce/src/modules/identity/05_interface_jieru/http/WechatOperations.ts';
  if (id === 'payment.intents.create') return '01_core_hexin/services/commerce/src/modules/payment_zhifu/03_application_yingyong/services_fuwu/ExternalPaymentIntentOperations.ts';
  return null;
}

function dimension(value, evidence) {
  const status = value === 'N/A' ? 'N/A' : value ? 'PASS' : 'FAIL';
  return Object.freeze({ status, evidence: Object.freeze(evidence.filter(Boolean)) });
}

function countStatuses(items) {
  return Object.fromEntries(dimensions.map((name) => [name, items.reduce((counts, row) => {
    counts[row[name].status] += 1;
    return counts;
  }, { PASS: 0, FAIL: 0, UNKNOWN: 0, 'N/A': 0 })]));
}

async function text(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function json(path) {
  return JSON.parse(await text(path));
}
