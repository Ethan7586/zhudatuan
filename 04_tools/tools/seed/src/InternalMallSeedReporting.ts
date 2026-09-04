import type { Client } from 'pg';

import { INTERNAL_MALL_DATASET, metadata, stableHash, stableId, type DatasetOptions, type InternalMallPlan, type OrderFixture } from './InternalMallFixtures';
import { insertRows, stage } from './InternalMallDatabase';
import { MALL_ID, STORE_IDS, SUPPLIER_IDS } from './InternalMallSeedCore';
import type { CommerceSeedState, PaymentFixture } from './InternalMallSeedCommerce';

export async function seedReporting(
  database: Client,
  options: DatasetOptions,
  plan: InternalMallPlan,
  commerce: CommerceSeedState,
): Promise<void> {
  const daily = await seedDailyStatements(database, plan, commerce.payments);
  await seedOrderProjections(database, plan);
  await seedFacts(database, plan, commerce.payments);
  const reconciliationCount = await seedReconciliations(database, options, plan);
  const completedOutbox = await database.query(`update runtime.outbox set published_at=occurred_at,claimed_by=null,claim_until=null
    where scope_id like 'itht:%' and published_at is null`);
  stage('reporting', {
    completed_outbox: completedOutbox.rowCount ?? 0,
    daily_statements: daily,
    order_projections: plan.orders.length,
    reconciliations: reconciliationCount,
    settlement_periods: Math.min(4, options.days),
  });
}

async function seedDailyStatements(database: Client, plan: InternalMallPlan, payments: readonly PaymentFixture[]): Promise<number> {
  const paymentByOrder = new Map(payments.map((payment) => [payment.order.id, payment]));
  const ledgerId = (await database.query<{ readonly id: string }>(
    "select finance.ledger_id($1,'CNY') id",
    [MALL_ID],
  )).rows[0]!.id;
  let opening = 0;
  const statements: unknown[][] = [];
  const projections: unknown[][] = [];
  const channelStatements: unknown[][] = [];
  for (let dayIndex = 0; dayIndex < plan.dailyCounts.length; dayIndex += 1) {
    const orders = plan.orders.filter((order) => order.dayIndex === dayIndex);
    const debit = orders.reduce((sum, order) => sum + (paymentByOrder.has(order.id) ? order.totalMinor : 0), 0);
    const credit = orders.reduce((sum, order) => sum + order.refundMinor, 0);
    const closing = opening + debit - credit;
    const date = dayDate(dayIndex);
    const id = `itht:statement:${date}`;
    const generated = `${date}T23:55:00+08:00`;
    const sourceHash = stableHash('daily-statement', dayIndex, opening, debit, credit, closing);
    statements.push([id, MALL_ID, date, date, 'CNY', opening, debit, credit, closing, 'replaced', `internal://statements/${date}`,
      sourceHash, generated, ledgerId, 'Asia/Shanghai', `${date}T00:00:00+08:00`, `${dayDate(dayIndex + 1)}T00:00:00+08:00`, sourceHash]);
    projections.push([id, MALL_ID, date, date, 'CNY', opening, debit, credit, closing, 'final', generated, 1]);
    channelStatements.push([`itht:channel-statement:${date}`, 'itht:connection:payment', 'mock-payment', MALL_ID, MALL_ID, date, date, 'Asia/Shanghai',
      `internal://channel-statements/${date}`, stableHash('channel-statement', date), generated]);
    opening = closing;
  }
  await insertRows(database, 'finance.statement', ['id', 'scope_id', 'period_start', 'period_end', 'currency', 'opening_minor', 'debit_minor', 'credit_minor',
    'closing_minor', 'state', 'object_ref', 'sha256', 'generated_at', 'ledger_id', 'legal_timezone', 'period_start_at', 'period_end_at', 'source_hash'], statements);
  await insertRows(database, 'reporting.financeprojection', ['statement_id', 'scope_id', 'period_start', 'period_end', 'currency', 'opening_minor', 'debit_minor',
    'credit_minor', 'closing_minor', 'state', 'watermark', 'projection_version'], projections);
  await insertRows(database, 'channel.statement', ['id', 'connection_id', 'provider', 'scope_id', 'partner_id', 'period_start', 'period_end', 'timezone',
    'object_ref', 'sha256', 'generated_at'], channelStatements);
  return statements.length;
}

async function seedOrderProjections(database: Client, plan: InternalMallPlan): Promise<void> {
  await insertRows(database, 'reporting.orderprojection', ['order_id', 'scope_id', 'order_number', 'payment_state', 'fulfillment_state', 'aftersale_state',
    'lifecycle_state', 'total_minor', 'currency', 'occurred_at', 'snapshot', 'watermark', 'projection_version'], plan.orders.map((order) => {
    const states = projectionStates(order);
    return [order.id, MALL_ID, order.number, states.payment, states.fulfillment, states.aftersale, states.lifecycle, order.totalMinor, 'CNY',
      order.times.createdAt, metadata({
        discount_minor: order.discountMinor,
        order_type: order.fulfillmentKind,
        payment_method: order.paymentBucket,
        refund_minor: order.refundMinor,
        service_fee_minor: order.serviceFeeMinor,
        status_bucket: order.status,
        suppliers: [...new Set(order.lines.map((line) => line.listing.product.supplierId))].sort(),
      }), lastTime(order), 1];
  }));
  await insertRows(database, 'reporting.projectionevent', ['event_id', 'event_type', 'event_version', 'aggregate_id', 'scope_id', 'occurred_at', 'projected_at'],
    plan.orders.map((order) => [`itht:projection-event:${String(order.index).padStart(5, '0')}`, 'order.placed', 1, order.id, MALL_ID,
      order.times.createdAt, lastTime(order)]));
}

async function seedFacts(database: Client, plan: InternalMallPlan, payments: readonly PaymentFixture[]): Promise<void> {
  const paymentByOrder = new Map(payments.map((payment) => [payment.order.id, payment]));
  const rows: unknown[][] = [];
  for (let dayIndex = 0; dayIndex < plan.dailyCounts.length; dayIndex += 1) {
    const orders = plan.orders.filter((order) => order.dayIndex === dayIndex);
    const paid = orders.filter((order) => paymentByOrder.has(order.id));
    const gross = paid.reduce((sum, order) => sum + order.totalMinor, 0);
    const refunds = paid.filter((order) => order.refundMinor > 0);
    const refundMinor = refunds.reduce((sum, order) => sum + order.refundMinor, 0);
    const voucherPayments = paid.flatMap((order) => paymentByOrder.get(order.id)!.tenders.filter((tender) => tender.kind === 'voucher'));
    const date = dayDate(dayIndex);
    const periodStart = `${date}T00:00:00+08:00`;
    const periodEnd = `${date}T23:59:59+08:00`;
    const watermark = `${date}T23:59:59+08:00`;
    const values = [
      ['sales.orders', paid.length, { mall: MALL_ID }],
      ['sales.amount', gross - refundMinor, { mall: MALL_ID }],
      ['mall.amount', gross - refundMinor, { mall: MALL_ID }],
      ['refund.orders', refunds.length, { mall: MALL_ID }],
      ['refund.amount', refundMinor, { mall: MALL_ID }],
      ['voucher.redemptions', voucherPayments.length, { mall: MALL_ID, store: 'all' }],
      ['voucher.amount', voucherPayments.reduce((sum, tender) => sum + tender.amountMinor, 0), { mall: MALL_ID, store: 'all' }],
    ] as const;
    for (const [metric, value, dimensions] of values) rows.push([metric, 1, MALL_ID, metadata(dimensions), periodStart, periodEnd, 'Asia/Shanghai',
      value, metric.endsWith('.orders') || metric.endsWith('.redemptions') ? null : 'CNY', watermark, 1]);
  }
  await insertRows(database, 'reporting.fact', ['metric_id', 'metric_version', 'scope_id', 'dimensions', 'period_start', 'period_end', 'timezone',
    'value_numeric', 'currency', 'watermark', 'projection_version'], rows);
}

async function seedReconciliations(database: Client, options: DatasetOptions, plan: InternalMallPlan): Promise<number> {
  const ranges = periodRanges(options.days, Math.min(4, options.days));
  const reconciliations: unknown[][] = [];
  const reconciliationConnections = new Map<string, readonly [string, string]>();
  const reconciliationStatements: unknown[][] = [];
  const statementLines: unknown[][] = [];
  const items: unknown[][] = [];
  const settlements: unknown[][] = [];
  const settlementLines: unknown[][] = [];
  const splits: unknown[][] = [];
  let sequence = 0;
  for (const [periodIndex, range] of ranges.entries()) {
    const periodOrders = plan.orders.filter((order) => order.dayIndex >= range.start && order.dayIndex <= range.end && order.status !== 'cancelled');
    const partners = [MALL_ID, ...SUPPLIER_IDS, ...STORE_IDS];
    for (const partner of partners) {
      const orders = partner === MALL_ID ? periodOrders : partner.startsWith('itht:supplier:')
        ? periodOrders.filter((order) => order.storeId === null && order.lines.some((line) => line.listing.product.supplierId === partner))
        : periodOrders.filter((order) => order.storeId === partner);
      if (orders.length === 0) continue;
      const gross = orders.reduce((sum, order) => sum + partnerGross(order, partner), 0);
      const refund = orders.reduce((sum, order) => sum + partnerRefund(order, partner), 0);
      const net = gross - refund;
      if (net <= 0) continue;
      sequence += 1;
      const period = `${dayDate(range.start)}/${dayDate(range.end)}`;
      const id = `itht:reconciliation:${String(sequence).padStart(4, '0')}`;
      const statementLineId = `itht:statement-line:${String(sequence).padStart(4, '0')}`;
      const itemId = `itht:reconciliation-item:${String(sequence).padStart(4, '0')}`;
      const providerKind = partner === MALL_ID ? 'mall' : partner.startsWith('itht:supplier:') ? 'supplier' : 'store';
      const provider = `mock-${providerKind}-${partner.slice(-2)}`;
      const connectionId = stableId('reconciliation-connection', partner);
      const providerStatementId = `itht:reconciliation-statement:${String(sequence).padStart(4, '0')}`;
      const statementHash = stableHash('reconciliation', periodIndex, partner, gross, refund);
      reconciliationConnections.set(partner, [connectionId, provider]);
      reconciliationStatements.push([providerStatementId, connectionId, provider, MALL_ID, partner, dayDate(range.start), dayDate(range.end),
        'Asia/Shanghai', `internal://reconciliation/${sequence}`, statementHash, `${dayDate(range.end)}T23:30:00+08:00`]);
      reconciliations.push([id, MALL_ID, provider, partner, period, providerStatementId, statementHash, 'approved', net, net, 0,
        'itht:system:reconciliation', 'itht:system:approver', metadata({ gross_minor: gross, refund_minor: refund, orders: orders.length }),
        `${dayDate(range.end)}T23:50:00+08:00`, 0]);
      statementLines.push([statementLineId, id, MALL_ID, 1, `MOCK-SUPPLIER-RECON-${String(sequence).padStart(4, '0')}`, 'payment', net, 0, 'CNY',
        `${dayDate(range.end)}T23:30:00+08:00`, stableHash('reconciliation-line', sequence)]);
      items.push([itemId, id, statementLineId, MALL_ID, 'payment', 'aggregate', `ITHT-RECON-${String(sequence).padStart(4, '0')}`, net, net, 0, 'matched', null,
        metadata({ partner, period }), null, null, null, null, null, 0]);
      if (partner !== MALL_ID) {
        const rawFee = orders.reduce((sum, order) => sum + settlementFee(order, partner), 0);
        const fee = Math.min(rawFee, net - 1);
        const amount = net - fee;
        const settlementId = `itht:settlement:${String(sequence).padStart(4, '0')}`;
        settlements.push([settlementId, partner, period, id, amount, 'CNY', 'paid', MALL_ID, 'itht:system:settlement', 'itht:system:approver',
          `${dayDate(range.end)}T23:40:00+08:00`, `${dayDate(range.end)}T23:45:00+08:00`, `${dayDate(range.end)}T23:55:00+08:00`,
          metadata({ dataset_id: INTERNAL_MALL_DATASET, order_count: orders.length }), 0, net, fee, 'net']);
        settlementLines.push([`itht:settlement-line:${String(sequence).padStart(4, '0')}`, settlementId, itemId, MALL_ID, 'reconciliation', id,
          amount, amount, 0, 'increase', 'frozen', null, `${dayDate(range.end)}T23:45:00+08:00`]);
        const partnerBasis = Math.floor(amount * 10_000 / net);
        splits.push([`itht:split:${String(sequence).padStart(4, '0')}:partner`, settlementId, MALL_ID, 'partner', partner, amount, partnerBasis, 'paid',
          `${dayDate(range.end)}T23:45:00+08:00`]);
        if (fee > 0) splits.push([`itht:split:${String(sequence).padStart(4, '0')}:platform`, settlementId, MALL_ID, 'platform', MALL_ID, fee,
          10_000 - partnerBasis, 'paid', `${dayDate(range.end)}T23:45:00+08:00`]);
      }
    }
  }
  await insertRows(database, 'channel.connection', ['id', 'provider', 'scope_id', 'status', 'contract_version', 'secret_ref', 'configuration',
    'connection_timeout_ms', 'response_timeout_ms', 'total_deadline_ms', 'max_concurrency', 'requests_per_second', 'max_attempts', 'failure_threshold',
    'recovery_ms', 'region', 'version'], [...reconciliationConnections.values()].map(([id, provider]) => [id, provider, MALL_ID, 'disabled',
      'mock.v1', null, metadata({ network: 'disabled', purpose: 'reconciliation' }), 100, 200, 1_000, 8, 100, 3, 5, 1_000, 'local', 0]));
  await insertRows(database, 'channel.statement', ['id', 'connection_id', 'provider', 'scope_id', 'partner_id', 'period_start', 'period_end', 'timezone',
    'object_ref', 'sha256', 'generated_at'], reconciliationStatements);
  await insertRows(database, 'finance.reconciliation', ['id', 'scope_id', 'provider', 'partner_id', 'period', 'statement_ref', 'statement_hash', 'state',
    'debit_minor', 'credit_minor', 'difference_minor', 'created_by', 'approved_by', 'evidence', 'updated_at', 'version'], reconciliations);
  await insertRows(database, 'finance.statementline', ['id', 'reconciliation_id', 'scope_id', 'sequence', 'external_reference', 'kind', 'amount_minor',
    'tax_minor', 'currency', 'occurred_at', 'raw_hash'], statementLines);
  await insertRows(database, 'finance.reconciliationitem', ['id', 'reconciliation_id', 'statement_line_id', 'scope_id', 'kind', 'internal_type', 'internal_id',
    'external_minor', 'internal_minor', 'difference_minor', 'state', 'reason_code', 'evidence', 'resolution', 'resolved_by', 'approved_by', 'resolved_at',
    'approved_at', 'version'], items);
  await insertRows(database, 'finance.settlement', ['id', 'partner_id', 'period', 'reconciliation_id', 'amount_minor', 'currency', 'state', 'scope_id',
    'requested_by', 'approved_by', 'frozen_at', 'approved_at', 'paid_at', 'evidence', 'version', 'gross_minor', 'fee_minor', 'invoice_basis'], settlements);
  await insertRows(database, 'finance.settlementline', ['id', 'settlement_id', 'reconciliation_item_id', 'scope_id', 'source_type', 'source_id', 'amount_minor',
    'invoice_minor', 'tax_minor', 'direction', 'state', 'adjustment_of', 'created_at'], settlementLines);
  await insertRows(database, 'finance.split', ['id', 'settlement_id', 'scope_id', 'beneficiary_type', 'beneficiary_id', 'amount_minor', 'basis_points', 'state', 'created_at'], splits);
  await insertRows(database, 'runtime.reconciliationevidence', ['id', 'source_count', 'target_count', 'source_amount', 'target_amount', 'difference', 'checked_at'],
    ranges.map((range, index) => {
      const orders = plan.orders.filter((order) => order.dayIndex >= range.start && order.dayIndex <= range.end && order.status !== 'cancelled');
      const amount = orders.reduce((sum, order) => sum + order.totalMinor - order.refundMinor, 0);
      return [`itht:reconciliation-evidence:${index + 1}`, orders.length, orders.length, amount, amount, 0, `${dayDate(range.end)}T23:59:00+08:00`];
    }));
  await insertRows(database, 'runtime.reconciliationhash', ['id', 'source_hash', 'target_hash', 'checked_at'], ranges.map((range, index) => {
    const hash = stableHash('reconciliation-period', index, range.start, range.end);
    return [`itht:reconciliation-hash:${index + 1}`, hash, hash, `${dayDate(range.end)}T23:59:00+08:00`];
  }));
  return reconciliations.length;
}

function periodRanges(days: number, count: number): Array<Readonly<{ end: number; start: number }>> {
  const result: Array<Readonly<{ end: number; start: number }>> = [];
  for (let index = 0; index < count; index += 1) {
    const start = Math.floor(index * days / count);
    const end = Math.floor((index + 1) * days / count) - 1;
    result.push(Object.freeze({ end, start }));
  }
  return result;
}

function partnerGross(order: OrderFixture, partner: string): number {
  if (partner === MALL_ID || order.storeId === partner) return order.totalMinor;
  const lines = order.lines.filter((line) => line.listing.product.supplierId === partner);
  const lineMinor = lines.reduce((sum, line) => sum + line.payableMinor, 0);
  const totalPayableLines = order.lines.reduce((sum, line) => sum + line.payableMinor, 0);
  const shared = totalPayableLines === 0 ? 0 : Math.floor((order.shippingMinor + order.serviceFeeMinor) * lineMinor / totalPayableLines);
  return lineMinor + shared;
}

function partnerRefund(order: OrderFixture, partner: string): number {
  if (order.refundMinor === 0) return 0;
  if (partner === MALL_ID || order.storeId === partner) return order.refundMinor;
  const gross = partnerGross(order, partner);
  return Math.min(gross, Math.floor(order.refundMinor * gross / order.totalMinor));
}

function settlementFee(order: OrderFixture, partner: string): number {
  if (order.serviceFeeType !== 'percentage_5' && order.serviceFeeType !== 'fixed') return 0;
  if (order.storeId === partner) return order.serviceFeeMinor;
  if (!partner.startsWith('itht:supplier:')) return 0;
  const primary = [...new Set(order.lines.map((line) => line.listing.product.supplierId))].sort()[0];
  return primary === partner ? order.serviceFeeMinor : 0;
}

function projectionStates(order: OrderFixture): Readonly<{ aftersale: string; fulfillment: string; lifecycle: string; payment: string }> {
  if (order.status === 'completed_physical') return { aftersale: 'none', fulfillment: 'delivered', lifecycle: 'completed', payment: 'paid' };
  if (order.status === 'redeemed') return { aftersale: 'none', fulfillment: 'delivered', lifecycle: 'completed', payment: 'paid' };
  if (order.status === 'shipped') return { aftersale: 'none', fulfillment: 'shipped', lifecycle: 'active', payment: 'paid' };
  if (order.status === 'paid_pending') return { aftersale: 'none', fulfillment: 'allocated', lifecycle: 'active', payment: 'paid' };
  if (order.status === 'cancelled') return { aftersale: 'none', fulfillment: 'cancelled', lifecycle: 'cancelled', payment: 'unpaid' };
  if (order.status === 'full_refund') return { aftersale: 'resolved', fulfillment: order.fulfillmentKind === 'shipment' ? 'cancelled' : 'delivered', lifecycle: 'closed', payment: 'refunded' };
  return { aftersale: 'resolved', fulfillment: 'returned', lifecycle: 'completed', payment: 'partially_refunded' };
}

function dayDate(dayIndex: number): string {
  const date = new Date('2026-08-17T00:00:00+08:00');
  date.setUTCDate(date.getUTCDate() + dayIndex);
  const local = new Date(date.getTime() + 8 * 60 * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
}

function lastTime(order: OrderFixture): string {
  return order.times.refundedAt ?? order.times.completedAt ?? order.times.shippedAt ?? order.times.redeemedAt ?? order.times.paidAt ?? order.times.cancelledAt ?? order.times.createdAt;
}
