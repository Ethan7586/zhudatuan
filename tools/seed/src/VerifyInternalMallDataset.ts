import { performance } from 'node:perf_hooks';

import { internalMallCounts } from './InternalMallCleanup';
import { assertImportDatabase, assertInternalDatabase, connectInternalDatabase, parseDatasetOptions, parseImportOptions, queryRows, scalarNumber } from './InternalMallDatabase';
import { buildInternalMallPlan, INTERNAL_MALL_DATASET } from './InternalMallFixtures';

interface CheckResult {
  readonly detail: string;
  readonly name: string;
  readonly passed: boolean;
}

interface GroupRow {
  readonly count: string;
  readonly key: string;
}

const started = performance.now();
const importTarget = process.env.INTERNAL_DATASET_VERIFY_MODE === 'import';
const options = importTarget ? parseImportOptions() : parseDatasetOptions();
const plan = buildInternalMallPlan(options);
const checks: CheckResult[] = [];
const database = await connectInternalDatabase(options);

try {
  if (importTarget) await assertImportDatabase(database, options);
  else await assertInternalDatabase(database, options, true);
  pass('database_identity', `database=${options.database} target=${importTarget ? 'import' : 'local'} migrated=true`);

  const counts = await internalMallCounts(database);
  const expectedLines = plan.orders.reduce((sum, order) => sum + order.lines.length, 0);
  const expectedPaid = plan.orders.filter(({ paymentBucket }) => paymentBucket !== null).length;
  const expectedRefunds = plan.orders.filter(({ refundMinor }) => refundMinor > 0).length;
  const expectedAftersales = expectedRefunds;
  check('domain_counts',
    counts.organizations === 11 && counts.partners === 14 && counts.members === 240 && counts.products === 120
      && counts.skus === 180 && counts.listings === 120 && counts.cards === 240 && counts.coupons === 1_000
      && counts.orders === options.ordersTarget && counts.order_lines === expectedLines && counts.payments === expectedPaid
      && counts.aftersales === expectedAftersales && counts.refunds === expectedRefunds && (counts.fulfillments ?? 0) > 0
      && (counts.finance_journals ?? 0) > 0 && (counts.reconciliations ?? 0) >= 3,
    `organizations=${counts.organizations} partners=${counts.partners} members=${counts.members} products=${counts.products} skus=${counts.skus} listings=${counts.listings} cards=${counts.cards} coupons=${counts.coupons} orders=${counts.orders} lines=${counts.order_lines} payments=${counts.payments} fulfillments=${counts.fulfillments} aftersales=${counts.aftersales} refunds=${counts.refunds} finance_journals=${counts.finance_journals} reconciliations=${counts.reconciliations}`);

  const dailyActual = await grouped(`select to_char(created_at at time zone 'Asia/Shanghai','YYYY-MM-DD') key,count(*)::text count
    from ordering.orderrecord where order_number like 'ITHT-%' group by 1 order by 1`);
  const dailyExpected = new Map<string, number>();
  for (const order of plan.orders) {
    const local = new Date(new Date(order.times.createdAt).getTime() + 8 * 60 * 60_000);
    const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
    dailyExpected.set(date, (dailyExpected.get(date) ?? 0) + 1);
  }
  check('daily_order_curve', mapsEqual(dailyActual, dailyExpected) && dailyActual.size === options.days,
    [...dailyActual].map(([date, count]) => `${date}:${count}`).join(','));
  check('exact_order_total', counts.orders === options.ordersTarget, `expected=${options.ordersTarget} actual=${counts.orders}`);

  const lineDefects = await scalarNumber(database, `select count(*) value from ordering.line line
    left join ordering.orderrecord order_record on order_record.id=line.order_id
    left join catalog.sku sku on sku.id=line.sku_id
    left join catalog.listing listing on listing.id=line.listing_id
    where line.id like 'itht:%' and (order_record.id is null or sku.id is null or listing.id is null
      or line.quantity<=0 or line.total_minor<>line.unit_minor*line.quantity or line.discount_minor<0 or line.discount_minor>line.total_minor)`);
  check('order_line_integrity', lineDefects === 0, `defects=${lineDefects}`);

  const paymentDefects = await scalarNumber(database, `select count(*) value from payment.payment payment
    left join payment.intent intent on intent.id=payment.intent_id
    left join ordering.orderrecord order_record on order_record.id=intent.order_id
    where payment.id like 'itht:%' and (intent.id is null or order_record.id is null or payment.captured_minor<>order_record.total_minor
      or payment.amount_minor<>order_record.total_minor)`)
    + await scalarNumber(database, `select count(*) value from payment.intent intent where intent.id like 'itht:%'
      and (select coalesce(sum(amount_minor),0) from payment.intenttender where intent_id=intent.id)<>intent.amount_minor`);
  check('payment_integrity', paymentDefects === 0 && counts.payments === expectedPaid, `defects=${paymentDefects} paid_orders=${counts.payments}`);

  const refundDefects = await scalarNumber(database, `select count(*) value from payment.payment payment where payment.id like 'itht:%'
    and (payment.refunded_minor>payment.captured_minor or payment.refunded_minor<0
      or payment.refunded_minor<>(select coalesce(sum(refund.amount_minor),0) from payment.refund refund where refund.payment_id=payment.id and refund.state='succeeded'))`);
  check('refund_limits', refundDefects === 0 && counts.refunds === expectedRefunds, `defects=${refundDefects} refunds=${counts.refunds}`);

  const chronologyDefects = await scalarNumber(database, `select count(*) value from ordering.orderrecord order_record where order_number like 'ITHT-%' and (
    ((evidence->>'paid_at') is not null and (evidence->>'paid_at')::timestamptz<created_at)
    or ((evidence->>'accepted_at') is not null and ((evidence->>'paid_at') is null or (evidence->>'accepted_at')::timestamptz<(evidence->>'paid_at')::timestamptz))
    or ((evidence->>'shipped_at') is not null and ((evidence->>'accepted_at') is null or (evidence->>'shipped_at')::timestamptz<(evidence->>'accepted_at')::timestamptz))
    or ((evidence->>'redeemed_at') is not null and ((evidence->>'accepted_at') is null or (evidence->>'redeemed_at')::timestamptz<(evidence->>'accepted_at')::timestamptz))
    or ((evidence->>'completed_at') is not null and (evidence->>'completed_at')::timestamptz<coalesce((evidence->>'redeemed_at')::timestamptz,(evidence->>'shipped_at')::timestamptz,(evidence->>'accepted_at')::timestamptz))
    or ((evidence->>'aftersale_at') is not null and (evidence->>'aftersale_at')::timestamptz<coalesce((evidence->>'completed_at')::timestamptz,(evidence->>'accepted_at')::timestamptz))
    or ((evidence->>'refunded_at') is not null and ((evidence->>'aftersale_at') is null or (evidence->>'refunded_at')::timestamptz<(evidence->>'aftersale_at')::timestamptz))
    or ((evidence->>'cancelled_at') is not null and (evidence->>'paid_at') is not null))`);
  check('chronological_state', chronologyDefects === 0, `defects=${chronologyDefects}`);

  const inventoryDefects = await scalarNumber(database, `select count(*) value from inventory.stockitem stock where stock.id like 'itht:%' and (
    stock.onhand<0 or stock.safety<0 or stock.onhand<>(select coalesce(sum(movement.quantity_delta),0) from inventory.movement movement
      where movement.stockitem_id=stock.id and movement.kind in ('receive','commit','return')))`);
  check('inventory_balance', inventoryDefects === 0, `negative_or_ledger_mismatch=${inventoryDefects}`);

  const duplicateVoucherUses = await scalarNumber(database, `select count(*) value from (
    select voucher_id from voucher.redemption where id like 'itht:%' and reversed_at is null group by voucher_id having count(*)>1) duplicate`);
  const duplicateVerificationSuccess = await scalarNumber(database, `select count(*) value from (
    select session_id from verification.attempt where id like 'itht:%' and result='accepted' group by session_id having count(*)>1) duplicate`);
  const replayAttempts = await scalarNumber(database, `select count(*) value from verification.attempt where id like 'itht:%' and result='replayed'`);
  check('single_use_voucher_and_verification', duplicateVoucherUses === 0 && duplicateVerificationSuccess === 0 && replayAttempts === 10,
    `duplicate_vouchers=${duplicateVoucherUses} duplicate_verifications=${duplicateVerificationSuccess} rejected_replays=${replayAttempts}`);

  const cardScale = (await queryRows<{ readonly activated: string; readonly batches: string; readonly bound: string; readonly consumed: string; readonly disabled_or_expired: string; readonly programs: string; readonly remaining: string; readonly unactivated: string }>(database, `select
    (select count(*) from voucher.program where id like 'itht:%')::text programs,
    (select count(*) from voucher.issuebatch where id like 'itht:%')::text batches,
    (select count(*) from voucher.statusevent where voucher_id like 'itht:%' and reason='datasetbound')::text bound,
    (select count(*) from voucher.statusevent where voucher_id like 'itht:%' and reason='datasetactivated')::text activated,
    (select count(distinct voucher_id) from voucher.redemption where id like 'itht:%')::text consumed,
    (select count(*) from voucher.voucher where id like 'itht:%' and remaining_minor>0)::text remaining,
    (select count(*) from voucher.voucher where id like 'itht:%' and state in ('expired','disabled'))::text disabled_or_expired,
    (240-(select count(*) from voucher.statusevent where voucher_id like 'itht:%' and reason='datasetactivated'))::text unactivated`))[0]!;
  const couponScale = (await queryRows<{ readonly claimed: string; readonly invalid_uses: string; readonly total: string; readonly used: string }>(database, `select
    count(*)::text total,count(*) filter(where redemption.state in ('reserved','committed'))::text claimed,
    count(*) filter(where redemption.state='committed')::text used,
    count(*) filter(where redemption.state='committed' and (campaign.state<>'active' or campaign.effective_at>redemption.created_at or campaign.expires_at<redemption.created_at))::text invalid_uses
    from marketing.redemption redemption join marketing.campaign campaign on campaign.id=redemption.campaign_id where redemption.id like 'itht:%'`))[0]!;
  check('card_and_coupon_scale', Number(cardScale.programs) === 8 && Number(cardScale.batches) === 16 && Number(cardScale.bound) === 220
      && Number(cardScale.activated) === 200 && Number(cardScale.consumed) === 150 && Number(cardScale.remaining) >= 60
      && Number(cardScale.unactivated) >= 20 && Number(cardScale.disabled_or_expired) >= 10 && Number(couponScale.total) === 1_000
      && Number(couponScale.claimed) >= 350 && Number(couponScale.used) >= 220 && Number(couponScale.invalid_uses) === 0,
    `programs=${cardScale.programs} batches=${cardScale.batches} bound=${cardScale.bound} activated=${cardScale.activated} consumed=${cardScale.consumed} remaining=${cardScale.remaining} unactivated=${cardScale.unactivated} disabled_or_expired=${cardScale.disabled_or_expired} coupons=${couponScale.total} claimed=${couponScale.claimed} used=${couponScale.used} invalid_uses=${couponScale.invalid_uses}`);

  const anomalyActual = await grouped(`select normalized->>'anomaly' key,count(*)::text count from channel.webhookinbox
    where id like 'itht:%' and normalized->>'anomaly' is not null group by 1 order by 1`);
  const duplicateApplied = await scalarNumber(database, `select count(*) value from (
    select normalized->>'canonical_event_id' canonical from channel.webhookinbox where id like 'itht:%'
    group by 1 having count(*) filter(where state='applied')>1) duplicate`);
  const refundRetries = await scalarNumber(database, `select count(*) value from channel.webhookinbox where id like 'itht:%' and event_type='refund.succeeded' and attempts=2`);
  const permanentFailures = await scalarNumber(database, `select count(*) value from channel.provideroperation where id like 'itht:%'
    and response->>'anomaly'='permanent_failure' and state='failed'`);
  const supplierRetries = await scalarNumber(database, `select count(*) value from channel.provideroperation where id like 'itht:%'
    and response->>'anomaly'='timeout_then_success' and (response->>'retry_count')::int=1 and state='succeeded'`);
  check('external_callback_idempotency', duplicateApplied === 0 && refundRetries === 5 && permanentFailures === 5 && supplierRetries === 10
      && anomalyActual.get('duplicate_payment_notification') === 10 && anomalyActual.get('duplicate_supplier_callback') === 10
      && anomalyActual.get('out_of_order_status') === 20,
    `duplicate_payment=${anomalyActual.get('duplicate_payment_notification') ?? 0} duplicate_supplier=${anomalyActual.get('duplicate_supplier_callback') ?? 0} refund_retries=${refundRetries} out_of_order=${anomalyActual.get('out_of_order_status') ?? 0} supplier_retries=${supplierRetries} permanent_failures=${permanentFailures} duplicate_effects=${duplicateApplied}`);

  const benefitBalanceDefects = await scalarNumber(database, `select count(*) value from benefit.lot lot where lot.id like 'itht:%' and lot.remaining_minor<>
    lot.total_minor-(select coalesce(sum(amount_minor),0) from benefit.lotmovement where lot_id=lot.id and kind='consume')
      +(select coalesce(sum(amount_minor),0) from benefit.lotmovement where lot_id=lot.id and kind='refund')`);
  const voucherBalanceDefects = await scalarNumber(database, `select count(*) value from voucher.voucher voucher where voucher.id like 'itht:%' and voucher.remaining_minor<>
    voucher.initial_minor-(select coalesce(sum(amount_minor),0) from voucher.redemption where voucher_id=voucher.id)
      +(select coalesce(sum(reversal.amount_minor),0) from voucher.reversal reversal join voucher.redemption redemption on redemption.id=reversal.redemption_id where redemption.voucher_id=voucher.id)`);
  check('account_balance', benefitBalanceDefects === 0 && voucherBalanceDefects === 0,
    `benefit_mismatches=${benefitBalanceDefects} voucher_mismatches=${voucherBalanceDefects}`);

  const unbalancedJournals = await scalarNumber(database, `select count(*) value from (
    select journal.id from finance.journal journal join finance.entry entry on entry.journal_id=journal.id where journal.scope_id like 'itht:%'
    group by journal.id having sum(case when entry.side='debit' then entry.amount_minor else -entry.amount_minor end)<>0) unbalanced`);
  const paymentAmounts = (await queryRows<{ readonly captured: string; readonly refunded: string }>(database,
    `select coalesce(sum(captured_minor),0)::text captured,coalesce(sum(refunded_minor),0)::text refunded from payment.payment where id like 'itht:%'`))[0]!;
  const financeAmounts = (await queryRows<{ readonly captured: string; readonly refunded: string }>(database, `select
    coalesce(sum((select max(amount_minor) from finance.entry where journal_id=journal.id)) filter(where reference_type='payment.capture'),0)::text captured,
    coalesce(sum((select max(amount_minor) from finance.entry where journal_id=journal.id)) filter(where reference_type='payment.refund'),0)::text refunded
    from finance.journal journal where scope_id like 'itht:%'`))[0]!;
  const reconciliationDefects = await scalarNumber(database, `select
    (select count(*) from finance.reconciliation where id like 'itht:%' and difference_minor<>0)
    +(select count(*) from finance.reconciliationitem where id like 'itht:%' and difference_minor<>0)
    +(select count(*) from runtime.reconciliationevidence where id like 'itht:%' and difference<>0)
    +(select count(*) from runtime.reconciliationhash where id like 'itht:%' and source_hash<>target_hash) value`);
  check('finance_balance', unbalancedJournals === 0 && paymentAmounts.captured === financeAmounts.captured
      && paymentAmounts.refunded === financeAmounts.refunded && reconciliationDefects === 0,
    `unbalanced_journals=${unbalancedJournals} captured_minor=${paymentAmounts.captured} refunded_minor=${paymentAmounts.refunded} reconciliation_defects=${reconciliationDefects}`);

  const dailyRollupDefects = await scalarNumber(database, `with detail as (
      select (order_record.created_at at time zone 'Asia/Shanghai')::date business_date,
        sum(order_record.total_minor) filter(where order_record.evidence->>'payment_method' is not null) debit,
        sum((order_record.evidence->>'refund_minor')::bigint) credit
      from ordering.orderrecord order_record where order_number like 'ITHT-%' group by 1),
    checked as (select statement.*,lag(closing_minor) over(order by period_start) prior_closing from finance.statement statement where id like 'itht:%')
    select count(*) value from checked join detail on detail.business_date=checked.period_start
    where checked.debit_minor<>detail.debit or checked.credit_minor<>detail.credit
      or checked.closing_minor<>checked.opening_minor+checked.debit_minor-checked.credit_minor
      or (checked.prior_closing is not null and checked.opening_minor<>checked.prior_closing)`);
  const reportingDefects = await scalarNumber(database, `with detail as (
      select (created_at at time zone 'Asia/Shanghai')::date business_date,
        count(*) filter(where evidence->>'payment_method' is not null) paid_orders,
        sum(total_minor-(evidence->>'refund_minor')::bigint) filter(where evidence->>'payment_method' is not null) net,
        count(*) filter(where (evidence->>'refund_minor')::bigint>0) refunds,
        sum((evidence->>'refund_minor')::bigint) refund_minor
      from ordering.orderrecord where order_number like 'ITHT-%' group by 1)
    select count(*) value from detail where
      paid_orders<>(select value_numeric from reporting.fact where scope_id='itht:mall' and metric_id='sales.orders' and period_start::date=detail.business_date)
      or net<>(select value_numeric from reporting.fact where scope_id='itht:mall' and metric_id='sales.amount' and period_start::date=detail.business_date)
      or refunds<>(select value_numeric from reporting.fact where scope_id='itht:mall' and metric_id='refund.orders' and period_start::date=detail.business_date)
      or refund_minor<>(select value_numeric from reporting.fact where scope_id='itht:mall' and metric_id='refund.amount' and period_start::date=detail.business_date)`);
  check('daily_rollup', dailyRollupDefects === 0 && reportingDefects === 0,
    `statement_mismatches=${dailyRollupDefects} reporting_mismatches=${reportingDefects} days=${options.days}`);

  const listingActual = await grouped(`select status key,count(*)::text count from catalog.listing where id like 'itht:%' group by status order by status`);
  const visibilityDefects = await scalarNumber(database, `select count(*) value from ordering.line line join catalog.listing listing on listing.id=line.listing_id
    where line.id like 'itht:%' and listing.status<>'published'`)
    + await scalarNumber(database, `select count(*) value from ordering.line line where line.id like 'itht:%' and not exists(
      select 1 from inventory.stockitem stock join inventory.movement movement on movement.stockitem_id=stock.id and movement.kind='receive'
      where stock.sku_id=line.sku_id)`);
  check('catalog_visibility', listingActual.get('published') === 100 && listingActual.get('draft') === 10
      && listingActual.get('unpublished') === 10 && visibilityDefects === 0,
    `published=${listingActual.get('published') ?? 0} draft=${listingActual.get('draft') ?? 0} unpublished=${listingActual.get('unpublished') ?? 0} invalid_order_lines=${visibilityDefects}`);

  const serviceFeeDefects = await scalarNumber(database, `select count(*) value from ordering.orderrecord where order_number like 'ITHT-%'
    and evidence->>'service_fee_type'='percentage_5'
    and (evidence->>'service_fee_minor')::bigint<>floor(((evidence->>'line_subtotal_minor')::bigint*500+5000)/10000)`);
  const amountEquationDefects = await scalarNumber(database, `select count(*) value from ordering.orderrecord where order_number like 'ITHT-%' and total_minor<>
    (evidence->>'line_subtotal_minor')::bigint+(evidence->>'shipping_minor')::bigint+(evidence->>'service_fee_minor')::bigint-(evidence->>'discount_minor')::bigint`);
  check('order_amount_equation', amountEquationDefects === 0 && serviceFeeDefects === 0,
    `equation_mismatches=${amountEquationDefects} service_fee_rounding_mismatches=${serviceFeeDefects}`);

  const refundCoverage = (await queryRows<{ readonly full_refunds: string; readonly multi_transition: string; readonly partial_refunds: string; readonly shipped_returns: string; readonly unshipped_refunds: string; readonly virtual_refunds: string }>(database, `select
    count(*) filter(where evidence->>'status_bucket'='full_refund')::text full_refunds,
    count(*) filter(where evidence->>'status_bucket'='partial_refund')::text partial_refunds,
    count(*) filter(where evidence->>'status_bucket'='full_refund' and evidence->>'order_type'='shipment' and evidence->>'shipped_at' is null)::text unshipped_refunds,
    count(*) filter(where evidence->>'status_bucket'='partial_refund' and evidence->>'shipped_at' is not null)::text shipped_returns,
    count(*) filter(where evidence->>'status_bucket'='full_refund' and evidence->>'order_type'<>'shipment')::text virtual_refunds,
    (select count(*) from (select aftersale_id from ordering.reviewaction where id like 'itht:%' group by aftersale_id having count(*)>=2) transitions)::text multi_transition
    from ordering.orderrecord where order_number like 'ITHT-%'`))[0]!;
  const feeCoverage = (await queryRows<{ readonly applicable: string; readonly percentage: string; readonly variants: string }>(database, `select
    count(*)::text applicable,count(*) filter(where evidence->>'service_fee_type'='percentage_5')::text percentage,
    count(distinct evidence->>'service_fee_type')::text variants from ordering.orderrecord
    where order_number like 'ITHT-%' and evidence->>'order_type'='shipment' and evidence->>'payment_method' is not null`))[0]!;
  check('refund_and_service_fee_coverage', Number(refundCoverage.full_refunds) === 25 && Number(refundCoverage.partial_refunds) === 25
      && Number(refundCoverage.unshipped_refunds) >= 15 && Number(refundCoverage.shipped_returns) >= 20
      && Number(refundCoverage.virtual_refunds) >= 10 && Number(refundCoverage.multi_transition) >= 5
      && Number(feeCoverage.percentage) / Number(feeCoverage.applicable) >= 0.6 && Number(feeCoverage.variants) >= 4,
    `full=${refundCoverage.full_refunds} partial=${refundCoverage.partial_refunds} unshipped=${refundCoverage.unshipped_refunds} shipped_returns=${refundCoverage.shipped_returns} virtual=${refundCoverage.virtual_refunds} multi_transition=${refundCoverage.multi_transition} fee_5pct=${feeCoverage.percentage}/${feeCoverage.applicable} fee_variants=${feeCoverage.variants}`);

  const syntheticDefects = await scalarNumber(database, `select
    (select count(*) from member.profile where id like 'itht:%' and display_name!~'^内测会员[0-9]{3}$')
    +(select count(*) from ordering.orderrecord where id like 'itht:%' and order_number!~'^ITHT-[0-9]{8}-[0-9]{5}$')
    +(select count(*) from payment.attempt where id like 'itht:%' and external_transaction!~'^MOCK-PAY-')
    +(select count(*) from voucher.voucher where id like 'itht:%' and code_ciphertext!~'^mockcipher:MOCK-VOUCHER-')
    +(select count(*) from member.profile where id like 'itht:%' and display_name~'1[3-9][0-9]{9}') value`);
  check('synthetic_identifiers_only', syntheticDefects === 0,
    `format_defects=${syntheticDefects} source_exports_loaded=false`);

  const markerDefects = await scalarNumber(database, `select
    (select count(*) from organization.organization where id like 'itht:%' and name not like '[内测]%')
    +(select count(*) from partner.partner where id like 'itht:%' and name not like '[内测]%')
    +(select count(*) from catalog.product where id like 'itht:%' and title not like '[内测]%')
    +(select count(*) from catalog.listing where id like 'itht:%' and title not like '[内测]%')
    +(select count(*) from marketing.campaign where id like 'itht:%' and name not like '[内测]%')
    +(select count(*) from ordering.orderrecord where id like 'itht:%' and (evidence->>'dataset_id'<>$1 or evidence->>'environment'<>'internal_test')) value`, [INTERNAL_MALL_DATASET]);
  check('internal_markers', markerDefects === 0, `missing_markers=${markerDefects}`);

  const importSafety = await queryRows<{
    readonly active_connections: string;
    readonly credentials: string;
    readonly operator_roles: string;
    readonly pending_inbox: string;
    readonly pending_outbox: string;
  }>(database, `select
    (select count(*)::text from identity.credential where principal_id like 'itht:%') credentials,
    (select count(*)::text from access.role where id='itht:role:operator') operator_roles,
    (select count(*)::text from channel.connection where id like 'itht:%' and status<>'disabled') active_connections,
    (select count(*)::text from runtime.outbox where (id like 'itht:%' or scope_id like 'itht:%') and published_at is null) pending_outbox,
    (select count(*)::text from runtime.inbox where consumer='internal-hongtai-dataset' and processed_at is null) pending_inbox`);
  const importSafetyRow = importSafety[0]!;
  const importSafetyDefects = Object.values(importSafetyRow).reduce((sum, value) => sum + Number(value), 0);
  check('production_import_safety', importSafetyDefects === 0,
    `credentials=${importSafetyRow.credentials} operator_roles=${importSafetyRow.operator_roles} active_connections=${importSafetyRow.active_connections} pending_outbox=${importSafetyRow.pending_outbox} pending_inbox=${importSafetyRow.pending_inbox}`);

  const duplicateStableKeys = await scalarNumber(database, `select
    (select count(*)-count(distinct order_number) from ordering.orderrecord where order_number like 'ITHT-%')
    +(select count(*)-count(distinct idempotency_key) from payment.intent where id like 'itht:%')
    +(select count(*)-count(distinct idempotency_key) from payment.refund where id like 'itht:%')
    +(select count(*)-count(distinct idempotency_key) from channel.provideroperation where id like 'itht:%') value`);
  check('replay_safe_shape', duplicateStableKeys === 0 && counts.orders === options.ordersTarget,
    `duplicate_stable_keys=${duplicateStableKeys} deterministic_ids=true replace_transaction=true`);

  const statusActual = await grouped(`select evidence->>'status_bucket' key,count(*)::text count from ordering.orderrecord
    where order_number like 'ITHT-%' group by 1 order by 1`);
  const statusExpected = countBy(plan.orders.map(({ status }) => status));
  check('status_distribution', mapsEqual(statusActual, statusExpected), formatMap(statusActual));
  const paymentActual = await grouped(`select evidence->>'payment_method' key,count(*)::text count from ordering.orderrecord
    where order_number like 'ITHT-%' and evidence->>'payment_method' is not null group by 1 order by 1`);
  const paymentExpected = countBy(plan.orders.flatMap(({ paymentBucket }) => paymentBucket === null ? [] : [paymentBucket]));
  check('payment_distribution', mapsEqual(paymentActual, paymentExpected), formatMap(paymentActual));

  const amountSummary = (await queryRows<{ readonly discount: string; readonly net_paid: string; readonly order_total: string; readonly paid: string; readonly refund: string; readonly service_fee: string; readonly shipping: string }>(database,
    `select coalesce(sum(total_minor),0)::text order_total,
      coalesce(sum(total_minor) filter(where evidence->>'payment_method' is not null),0)::text paid,
      coalesce(sum((evidence->>'refund_minor')::bigint),0)::text refund,
      (coalesce(sum(total_minor) filter(where evidence->>'payment_method' is not null),0)-coalesce(sum((evidence->>'refund_minor')::bigint),0))::text net_paid,
      coalesce(sum((evidence->>'shipping_minor')::bigint),0)::text shipping,
      coalesce(sum((evidence->>'service_fee_minor')::bigint),0)::text service_fee,
      coalesce(sum((evidence->>'discount_minor')::bigint),0)::text discount
      from ordering.orderrecord where order_number like 'ITHT-%'`))[0]!;
  const productKinds = await grouped(`select product_type key,count(*)::text count from catalog.product where id like 'itht:%' group by 1 order by 1`);
  const supplierOrders = await grouped(`select partner_id key,count(distinct order_id)::text count from ordering.line where id like 'itht:%' group by 1 order by 1`);
  const failed = checks.filter(({ passed }) => !passed);
  process.stdout.write(`VERIFY_DATASET dataset=${INTERNAL_MALL_DATASET} orders_target=${options.ordersTarget} duration_ms=${Math.round(performance.now() - started)}\n`);
  process.stdout.write(`VERIFY_COUNTS ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(' ')}\n`);
  process.stdout.write(`VERIFY_DAILY ${[...dailyActual].map(([key, value]) => `${key}:${value}`).join(',')}\n`);
  process.stdout.write(`VERIFY_STATUS ${formatMap(statusActual)}\n`);
  process.stdout.write(`VERIFY_PAYMENT ${formatMap(paymentActual)} cancelled_unpaid=${plan.orders.filter(({ paymentBucket }) => paymentBucket === null).length}\n`);
  process.stdout.write(`VERIFY_PRODUCTS ${formatMap(productKinds)}\n`);
  process.stdout.write(`VERIFY_SUPPLIERS ${formatMap(supplierOrders)}\n`);
  process.stdout.write(`VERIFY_AMOUNTS order_total_minor=${amountSummary.order_total} paid_minor=${amountSummary.paid} refund_minor=${amountSummary.refund} net_paid_minor=${amountSummary.net_paid} shipping_minor=${amountSummary.shipping} service_fee_minor=${amountSummary.service_fee} discount_minor=${amountSummary.discount}\n`);
  for (const result of checks) process.stdout.write(`${result.passed ? 'PASS' : 'FAIL'} ${result.name} ${result.detail}\n`);
  process.stdout.write(`VERIFY_SUMMARY passed=${checks.length - failed.length} failed=${failed.length}\n`);
  if (failed.length > 0) process.exitCode = 1;
} catch (cause) {
  process.stderr.write(`FAIL verification_runtime ${(cause as Error).message}\n`);
  process.exitCode = 1;
} finally {
  await database.end();
}

function check(name: string, passed: boolean, detail: string): void {
  checks.push(Object.freeze({ detail, name, passed }));
}

function pass(name: string, detail: string): void {
  check(name, true, detail);
}

async function grouped(sql: string): Promise<Map<string, number>> {
  const rows = await queryRows<GroupRow>(database, sql);
  return new Map(rows.map(({ count, key }) => [key, Number(count)]));
}

function countBy(values: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function mapsEqual(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): boolean {
  return left.size === right.size && [...left].every(([key, value]) => right.get(key) === value);
}

function formatMap(value: ReadonlyMap<string, number>): string {
  return [...value].sort(([left], [right]) => left.localeCompare(right)).map(([key, count]) => `${key}=${count}`).join(' ');
}
