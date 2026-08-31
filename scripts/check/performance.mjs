#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot as root } from '../lib/RepositoryRoot.mjs';

const capacity = parse(readFileSync(join(root, 'config/capacity.yml'), 'utf8'));
const telemetry = parse(readFileSync(join(root, 'config/telemetry.yml'), 'utf8'));
const violations = [];
const requiredSlo = { catalogP95Ms: 150, queryP95Ms: 300, detailP95Ms: 500, commandP95Ms: 800, orderP95Ms: 1500, webhookDurableAcceptP99Ms: 500, outboxP99Seconds: 30, availabilityPercent: 99.95, rpoMinutes: 5, rtoMinutes: 30 };
for (const [name, value] of Object.entries(requiredSlo)) {
  if (telemetry?.slo?.[name] !== value) violation('config/telemetry.yml', 'SLO_TARGET_MISMATCH', `${name}=${telemetry?.slo?.[name]}`);
}
const model = capacity?.model ?? {};
for (const [name, value] of Object.entries({ malls: 1000, members: 10000000, products: 5000000, skus: 20000000, peakApiQps: 5000, peakOrderTps: 300, peakPaymentCallbackTps: 600, voucherBatch: 1000000 })) {
  if (model[name] !== value) violation('config/capacity.yml', 'CAPACITY_BASELINE_MISMATCH', `${name}=${model[name]}`);
}
const profiles = Object.values(capacity.runtime.pool);
const poolConnections = profiles.reduce((sum, profile) => sum + profile.maximumConnections, 0);
const budget = capacity.runtime.poolBudget;
if (poolConnections * 100 > budget.databaseMaximumConnections * budget.maximumUtilizationPercent || budget.maximumUtilizationPercent > 70) {
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
    if (/\.map\s*\(/.test(body) && !/(?:semaphore|bulkhead)\.(?:use|run)\s*\(/.test(body) && !name.endsWith('/foundation/performance/Parallel.ts') && !name.endsWith('/foundation/persistence/Pool.ts')) {
      violation(name, 'UNBOUNDED_PROMISE_ALL', 'use mapParallel or a bounded primitive');
    }
  }
}

const checkout = readFileSync(join(root, 'services/commerce/src/modules/checkout/application/QuoteReader.ts'), 'utf8');
for (const proof of ['allParallel(', 'concurrency: 4', 'expiresAt:', 'signal:']) {
  if (!checkout.includes(proof)) violation('services/commerce/src/modules/checkout/application/QuoteReader.ts', 'CHECKOUT_BOUNDED_READ_PROOF_MISSING', proof);
}
const versioned = readFileSync(join(root, 'services/commerce/src/foundation/cache/VersionedKey.ts'), 'utf8');
if (!versioned.includes('CACHE_CATALOG[name].key')) {
  violation('services/commerce/src/foundation/cache/VersionedKey.ts', 'CACHE_VERSION_MISSING', 'catalog-driven fact version');
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log(`performance accepted=true pool=${poolConnections}/${budget.databaseMaximumConnections} sql=50/200 violations=0`);

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
