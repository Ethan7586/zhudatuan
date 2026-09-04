import { performance } from 'node:perf_hooks';

import { cleanupInternalMallDataset, internalMallCounts } from './InternalMallCleanup';
import { assertInternalDatabase, connectInternalDatabase, parseDatasetOptions } from './InternalMallDatabase';
import { buildInternalMallPlan, INTERNAL_MALL_DATASET } from './InternalMallFixtures';
import { seedCommerce } from './InternalMallSeedCommerce';
import { seedCore } from './InternalMallSeedCore';
import { seedReporting } from './InternalMallSeedReporting';

const started = performance.now();
const options = parseDatasetOptions();
const plan = buildInternalMallPlan(options);
const database = await connectInternalDatabase(options);

try {
  await assertInternalDatabase(database, options, true);
  await database.query('begin');
  try {
    await cleanupInternalMallDataset(database);
    const core = await seedCore(database, options, plan);
    const commerce = await seedCommerce(database, options, plan, core);
    await seedReporting(database, options, plan, commerce);
    await database.query('commit');
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
  const counts = await internalMallCounts(database);
  const duration = Math.round(performance.now() - started);
  process.stdout.write(`DATASET_SEEDED dataset=${INTERNAL_MALL_DATASET} requested_orders=${options.ordersTarget} generated_orders=${counts.orders ?? 0} generated_order_lines=${counts.order_lines ?? 0} duration_ms=${duration}\n`);
} finally {
  await database.end();
}
