import { cleanupInternalMallDataset, internalMallCounts } from './InternalMallCleanup';
import { assertInternalDatabase, connectInternalDatabase, parseDatasetOptions, scalarNumber } from './InternalMallDatabase';
import { INTERNAL_MALL_DATASET } from './InternalMallFixtures';

const options = parseDatasetOptions();
const database = await connectInternalDatabase(options);

try {
  await assertInternalDatabase(database, options, true);
  await database.query('begin');
  try {
    const before = await internalMallCounts(database);
    process.stdout.write(`CLEANUP_BEFORE dataset=${INTERNAL_MALL_DATASET} ${formatCounts(before)}\n`);
    await cleanupInternalMallDataset(database);
    const after = await internalMallCounts(database);
    const residual = await scalarNumber(database, `select
      (select count(*) from checkout.session where id like 'itht:%')
      +(select count(*) from inventory.movement where id like 'itht:%')
      +(select count(*) from benefit.lot where id like 'itht:%')
      +(select count(*) from voucher.redemption where id like 'itht:%')
      +(select count(*) from marketing.campaign where id like 'itht:%')
      +(select count(*) from access.membership where id like 'itht:%')
      +(select count(*) from identity.principal where id like 'itht:%')
      +(select count(*) from reporting.fact where scope_id like 'itht:%')
      +(select count(*) from runtime.outbox where id like 'itht:%' or scope_id like 'itht:%')
      +(select count(*) from channel.webhookinbox where id like 'itht:%')
      +(select count(*) from finance.statement where id like 'itht:%') value`);
    const majorResidual = Object.values(after).reduce((sum, count) => sum + count, 0);
    if (majorResidual !== 0 || residual !== 0) throw new Error(`INTERNAL_DATASET_CLEANUP_RESIDUAL:major=${majorResidual}:dependent=${residual}`);
    await database.query('commit');
    process.stdout.write(`CLEANUP_AFTER dataset=${INTERNAL_MALL_DATASET} ${formatCounts(after)} residual=${residual}\n`);
    process.stdout.write('PASS cleanup_dataset_only all_dataset_records=0 other_local_data=preserved\n');
  } catch (cause) {
    await database.query('rollback');
    throw cause;
  }
} catch (cause) {
  process.stderr.write(`FAIL cleanup_runtime ${(cause as Error).message}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}

function formatCounts(counts: Readonly<Record<string, number>>): string {
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(' ');
}
