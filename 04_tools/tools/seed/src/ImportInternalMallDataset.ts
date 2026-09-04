import { performance } from 'node:perf_hooks';

import { internalMallCounts } from './InternalMallCleanup';
import { assertImportDatabase, connectInternalDatabase, parseImportOptions } from './InternalMallDatabase';
import { buildInternalMallPlan, INTERNAL_MALL_DATASET } from './InternalMallFixtures';
import { seedCommerce } from './InternalMallSeedCommerce';
import { seedCore } from './InternalMallSeedCore';
import { seedReporting } from './InternalMallSeedReporting';

const started = performance.now();
const options = parseImportOptions();
const plan = buildInternalMallPlan(options);
const database = await connectInternalDatabase(options);

try {
  await assertImportDatabase(database, options);
  await database.query('begin');
  try {
    await database.query('select pg_advisory_xact_lock(hashtext($1))', [INTERNAL_MALL_DATASET]);
    const before = await internalMallCounts(database);
    const datasetRows = Object.values(before).reduce((sum, count) => sum + count, 0);
    if ((before.orders ?? 0) > 0) {
      assertCompleteExistingDataset(before);
      await database.query('commit');
      process.stdout.write(`IMPORT_NOOP dataset=${INTERNAL_MALL_DATASET} orders=${before.orders ?? 0} reason=already_imported\n`);
    } else {
      if (datasetRows !== 0) throw new Error(`INTERNAL_DATASET_IMPORT_PARTIAL_NAMESPACE_PRESENT:rows=${datasetRows}`);
      const core = await seedCore(database, options, plan);
      const commerce = await seedCommerce(database, options, plan, core);
      await seedReporting(database, options, plan, commerce);
      await database.query('commit');
      const counts = await internalMallCounts(database);
      assertCompleteExistingDataset(counts);
      process.stdout.write(`DATASET_IMPORTED dataset=${INTERNAL_MALL_DATASET} orders=${counts.orders ?? 0} order_lines=${counts.order_lines ?? 0} duration_ms=${Math.round(performance.now() - started)}\n`);
    }
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
} catch (cause) {
  process.stderr.write(`IMPORT_FAIL dataset=${INTERNAL_MALL_DATASET} ${safeDatabaseError(cause)}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}

function safeDatabaseError(cause: unknown): string {
  const error = cause as Error & { readonly code?: string; readonly constraint?: string; readonly routine?: string; readonly schema?: string; readonly table?: string };
  return [
    `reason=${error.message}`,
    error.code ? `code=${error.code}` : null,
    error.schema ? `schema=${error.schema}` : null,
    error.table ? `table=${error.table}` : null,
    error.constraint ? `constraint=${error.constraint}` : null,
    error.routine ? `routine=${error.routine}` : null,
  ].filter(Boolean).join(' ');
}

function assertCompleteExistingDataset(counts: Readonly<Record<string, number>>): void {
  const expected = new Map<string, number>([
    ['members', plan.members.length],
    ['products', plan.products.length],
    ['skus', plan.skus.length],
    ['listings', plan.listings.length],
    ['orders', options.ordersTarget],
    ['order_lines', plan.orders.reduce((sum, order) => sum + order.lines.length, 0)],
    ['payments', plan.orders.filter((order) => order.status !== 'cancelled').length],
    ['aftersales', plan.orders.filter((order) => order.refundMinor > 0).length],
    ['refunds', plan.orders.filter((order) => order.refundMinor > 0).length],
  ]);
  const mismatches = [...expected].filter(([domain, count]) => counts[domain] !== count);
  if (mismatches.length > 0) {
    throw new Error(`INTERNAL_DATASET_IMPORT_EXISTING_DATA_INCOMPLETE:${mismatches.map(([domain, count]) => `${domain}=${counts[domain] ?? 0}/${count}`).join(',')}`);
  }
}
