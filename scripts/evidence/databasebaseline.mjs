import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const environment = parseEnvironment(await readFile(join(repository, 'infrastructure/container/local/.env.local'), 'utf8'));
const output = join(repository, 'docs/evidence/fusion/DatabaseBaseline20260904.json');
const container = process.env.ZHUDATUAN_POSTGRES_CONTAINER ?? 'zhudatuan-local-postgres-1';
const user = required(environment.POSTGRES_USER, 'LOCAL_POSTGRES_USER_MISSING');
const database = required(environment.POSTGRES_DB, 'LOCAL_POSTGRES_DATABASE_MISSING');

const sql = String.raw`
with snapshot as (
  select
    (select count(*)::integer from information_schema.tables where table_schema not in('pg_catalog','information_schema')) tables,
    (select count(*)::integer from supabase_migrations.schema_migrations) migrations,
    (select count(*)::integer from runtime.operation) operations,
    (select count(*)::integer from runtime.event where retired_at is null) events,
    (select count(*)::integer from pg_tables where schemaname='public') publictables,
    (select count(*)::integer from ordering.orderrecord) orders,
    (select coalesce(sum(total_minor),0)::bigint from ordering.orderrecord) orderminor,
    (select count(*)::integer from payment.intent) paymentintents,
    (select coalesce(sum(amount_minor),0)::bigint from payment.intent) paymentintentminor,
    (select count(*)::integer from payment.payment) payments,
    (select coalesce(sum(captured_minor),0)::bigint from payment.payment) capturedminor,
    (select coalesce(sum(refunded_minor),0)::bigint from payment.payment) refundedminor,
    (select count(*)::integer from finance.journal) journals,
    (select coalesce(sum(amount_minor) filter(where side='debit'),0)::bigint from finance.entry) debitminor,
    (select coalesce(sum(amount_minor) filter(where side='credit'),0)::bigint from finance.entry) creditminor,
    (select count(*)::integer from finance.journal journal where
      (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)
       from finance.entry entry where entry.journal_id=journal.id)<>0) unbalancedjournals,
    (select count(*)::integer from inventory.stockitem) stockitems,
    (select coalesce(sum(onhand),0)::bigint from inventory.stockitem) onhand,
    (select coalesce(sum(safety),0)::bigint from inventory.stockitem) safety,
    (select coalesce(sum(quantity),0)::bigint from inventory.reservation where state='reserved') reserved,
    (select count(*)::integer from voucher.voucher) vouchers,
    (select coalesce(sum(initial_minor),0)::bigint from voucher.voucher) voucherinitialminor,
    (select coalesce(sum(remaining_minor),0)::bigint from voucher.voucher) voucherremainingminor,
    (select count(*)::integer from voucher.hold where state in('pending','active')) activevoucherholds,
    (select coalesce(sum(amount_minor),0)::bigint from voucher.hold where state in('pending','active')) voucherholdminor,
    (select coalesce(sum(amount_minor),0)::bigint from voucher.redemption where reversed_at is null) voucherredeemedminor,
    (select coalesce(sum(balance_minor),0)::bigint from benefit.balance) benefitbalanceminor,
    (select coalesce(sum(remaining_minor),0)::bigint from benefit.lot where state='active') benefitremainingminor,
    (select count(*)::integer from runtime.outbox) outbox,
    (select count(*)::integer from runtime.outbox where published_at is null and failed_at is null) pendingoutbox,
    (select count(*)::integer from runtime.inbox) inbox,
    (select count(*)::integer from runtime.inbox where processed_at is null) pendinginbox,
    (select count(*)::integer from reporting.watermark) watermarks,
    (select coalesce(min(version),0)::bigint from reporting.watermark) watermarkminversion,
    (select coalesce(max(version),0)::bigint from reporting.watermark) watermarkmaxversion,
    (select max(advanced_at) from reporting.watermark) watermarkadvancedat
)
select jsonb_build_object(
  'schema','zhudatuan.database-baseline.v1',
  'capturedAt',clock_timestamp(),
  'environment','local-deterministic',
  'catalog',jsonb_build_object('tables',tables,'migrations',migrations,'operations',operations,'events',events,'publicTables',publictables),
  'counts',jsonb_build_object('orders',orders,'paymentIntents',paymentintents,'payments',payments,'journals',journals,'stockItems',stockitems,'vouchers',vouchers,'activeVoucherHolds',activevoucherholds,'outbox',outbox,'inbox',inbox,'watermarks',watermarks),
  'amountsMinor',jsonb_build_object('orders',orderminor,'paymentIntents',paymentintentminor,'captured',capturedminor,'refunded',refundedminor,'financeDebit',debitminor,'financeCredit',creditminor,'voucherInitial',voucherinitialminor,'voucherRemaining',voucherremainingminor,'voucherHeld',voucherholdminor,'voucherRedeemed',voucherredeemedminor,'benefitBalance',benefitbalanceminor,'benefitRemaining',benefitremainingminor),
  'watermark',jsonb_build_object('minimumVersion',watermarkminversion,'maximumVersion',watermarkmaxversion,'lastAdvancedAt',watermarkadvancedat),
  'invariants',jsonb_build_object('unbalancedJournals',unbalancedjournals,'pendingOutbox',pendingoutbox,'pendingInbox',pendinginbox)
)::text from snapshot;
`;

const { stdout } = await execute('docker', ['exec', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', database, '-At', '-c', sql], {
  cwd: repository,
  maxBuffer: 16 * 1024 * 1024,
});
const document = JSON.parse(stdout.trim());
document.findings = baselineFindings(document);
assertBaseline(document);
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
process.stdout.write(`database baseline recorded: tables=${document.catalog.tables} migrations=${document.catalog.migrations} operations=${document.catalog.operations} events=${document.catalog.events}\n`);

function assertBaseline(document) {
  if (document.catalog.publicTables !== 0) throw new Error(`DATABASE_PUBLIC_TABLES_PRESENT:${document.catalog.publicTables}`);
  if (document.invariants.unbalancedJournals !== 0) throw new Error(`DATABASE_JOURNAL_IMBALANCE:${document.invariants.unbalancedJournals}`);
  if (document.amountsMinor.financeDebit !== document.amountsMinor.financeCredit) throw new Error('DATABASE_LEDGER_TOTAL_IMBALANCE');
}

function baselineFindings(document) {
  const findings = [];
  const benefitDelta = document.amountsMinor.benefitBalance - document.amountsMinor.benefitRemaining;
  if (benefitDelta !== 0) findings.push({ id: 'benefit.globalbalance.delta', owner: 'benefit', state: 'open', valueMinor: benefitDelta });
  if (document.invariants.pendingOutbox !== 0) findings.push({ id: 'runtime.outbox.pending', owner: 'runtime', state: 'open', count: document.invariants.pendingOutbox });
  if (document.invariants.pendingInbox !== 0) findings.push({ id: 'runtime.inbox.pending', owner: 'runtime', state: 'open', count: document.invariants.pendingInbox });
  return findings;
}

function parseEnvironment(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error('LOCAL_ENVIRONMENT_LINE_INVALID');
        const key = line.slice(0, separator);
        const raw = line.slice(separator + 1);
        const value = raw.length >= 2 && raw[0] === raw.at(-1) && ['"', "'"].includes(raw[0]) ? raw.slice(1, -1) : raw;
        return [key, value];
      })
  );
}

function required(value, code) {
  if (!value) throw new Error(code);
  return value;
}
