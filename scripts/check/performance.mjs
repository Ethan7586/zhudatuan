#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot as root } from '../lib/RepositoryRoot.mjs';

const capacity = parse(readFileSync(join(root, 'config/capacity.yml'), 'utf8'));
const telemetry = parse(readFileSync(join(root, 'config/telemetry.yml'), 'utf8'));
const violations = [];
const requiredSlo = { catalogP95Ms: 150, queryP95Ms: 300, facetP95Ms: 600, detailP95Ms: 500, writeP95Ms: 500, jobReceiptP95Ms: 2000, checkoutQuoteP95Ms: 800, checkoutConfirmP95Ms: 1000, commandP95Ms: 800, orderP95Ms: 1500, webhookDurableAcceptP99Ms: 500, outboxP99Seconds: 30, employeeInvitationCreateP95Ms: 300, invitationResolveP95Ms: 300, enrollmentCompleteP95Ms: 800, supportMessageSendP95Ms: 300, supportConversationP95Ms: 500, supportQueueP95Ms: 500, supportEventDeliveryP95Ms: 1000, availabilityPercent: 99.95, rpoMinutes: 0, rtoMinutes: 15 };
for (const [name, value] of Object.entries(requiredSlo)) {
  if (telemetry?.slo?.[name] !== value) violation('config/telemetry.yml', 'SLO_TARGET_MISMATCH', `${name}=${telemetry?.slo?.[name]}`);
}
const webVitals = telemetry?.browser?.budgets;
if (webVitals?.lcpP75Ms !== 2500 || webVitals?.inpP75Ms !== 200 || webVitals?.clsMaximum !== 0.1) {
  violation('config/telemetry.yml', 'WEB_VITAL_BUDGET_MISMATCH', JSON.stringify(webVitals));
}
const model = capacity?.model ?? {};
for (const [name, value] of Object.entries({ malls: 1000, members: 10000000, products: 5000000, skus: 20000000, peakApiQps: 5000, peakOrderTps: 300, peakPaymentCallbackTps: 600, voucherBatch: 1000000 })) {
  if (model[name] !== value) violation('config/capacity.yml', 'CAPACITY_BASELINE_MISMATCH', `${name}=${model[name]}`);
}
const profiles = Object.values(capacity.runtime.pool);
const poolConnections = profiles.reduce((sum, profile) => sum + profile.maximumConnections, 0);
const budget = capacity.runtime.poolBudget;
const sessionConnections = Math.max(capacity.runtime.pool.query.maximumConnections + capacity.runtime.pool.command.maximumConnections, capacity.runtime.pool.worker.maximumConnections, capacity.runtime.pool.migration.maximumConnections);
if (poolConnections * 100 > budget.databaseMaximumConnections * budget.maximumUtilizationPercent || sessionConnections * 100 > budget.sessionMaximumConnections * budget.maximumUtilizationPercent || budget.maximumUtilizationPercent > 70) {
  violation('config/capacity.yml', 'POOL_BUDGET_EXCEEDED', `${poolConnections}/${budget.databaseMaximumConnections}`);
}
if (capacity.runtime.sql.defaultRows !== 50 || capacity.runtime.sql.maximumRows !== 200) {
  violation('config/capacity.yml', 'KEYSET_LIMIT_INVALID', JSON.stringify(capacity.runtime.sql));
}

for (const file of sources(join(root, 'services/commerce/src'))) {
  const name = relative(root, file);
  const source = readFileSync(file, 'utf8');
  if (/\bselect\s+(?:[a-z][a-z0-9_]*\.)?\*/i.test(source)) violation(name, 'SELECT_STAR_FORBIDDEN', 'use an explicit projection');
  if (/\boffset\s+(?:\$\d+|\d+)/i.test(source)) violation(name, 'OFFSET_PAGINATION_FORBIDDEN', 'use a stable keyset cursor');
  for (const match of source.matchAll(/Promise\.all\(([\s\S]{0,500}?)\)\)/g)) {
    const body = match[1] ?? '';
    if (/\.map\s*\(/.test(body) && !/(?:semaphore|bulkhead)\.(?:use|run)\s*\(/.test(body) && !name.endsWith('/platform/database/Pool.ts')) {
      violation(name, 'UNBOUNDED_PROMISE_ALL', 'use mapParallel or a bounded primitive');
    }
  }
}

const checkoutPath = 'services/commerce/src/modules/checkout/application/service/QuoteReader.ts';
const checkout = [checkoutPath, 'services/commerce/src/modules/checkout/application/service/QuoteDataReader.ts']
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');
for (const proof of ['allParallel(', 'concurrency: 4', 'expiresAt:', 'signal:']) {
  if (!checkout.includes(proof)) violation(checkoutPath, 'CHECKOUT_BOUNDED_READ_PROOF_MISSING', proof);
}
const voucherBatchPath = 'services/commerce/src/modules/voucher/infrastructure/persistence/PgIssueBatchProcess.ts';
const voucherBatch = [voucherBatchPath, 'services/commerce/src/modules/voucher/infrastructure/persistence/IssueBatchStore.ts']
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n');
for (const proof of ['const CHUNK_SIZE = 250', 'for update skip locked', 'jobs.progress', 'on conflict(batch_id,ordinal) do nothing']) {
  if (!voucherBatch.includes(proof)) violation(voucherBatchPath, 'VOUCHER_BATCH_BOUNDARY_MISSING', proof);
}
const importPath = 'services/commerce/src/modules/runtime/application/process/StageImport.ts';
const importing = readFileSync(join(root, importPath), 'utf8');
for (const proof of ['AsyncIterable', 'IMPORT_CAPACITY.chunkRows', 'cursor.staged', 'assertLease', 'abandon(', 'continue(']) {
  if (!importing.includes(proof)) violation(importPath, 'IMPORT_RECOVERY_BOUNDARY_MISSING', proof);
}
const versioned = readFileSync(join(root, 'services/commerce/src/platform/cache/VersionedKey.ts'), 'utf8');
if (!versioned.includes('CACHE_CATALOG[name].key')) {
  violation('services/commerce/src/platform/cache/VersionedKey.ts', 'CACHE_VERSION_MISSING', 'catalog-driven fact version');
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log(`performance accepted=true pool=${poolConnections}/${budget.databaseMaximumConnections} session=${sessionConnections}/${budget.sessionMaximumConnections} sql=50/200 violations=0`);

function violation(location, code, detail) {
  violations.push(`code=${code} location=${location} detail=${detail}`);
}
function sources(directory) {
  const values = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) values.push(...sources(path));
    else if (entry.isFile() && path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('.generated.ts')) values.push(path);
  }
  return values.sort();
}
