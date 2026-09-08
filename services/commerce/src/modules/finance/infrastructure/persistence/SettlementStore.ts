import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { PayoutGateway } from '../../application/port/PayoutGateway';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import type { FinanceJobExecution, SettlementJobProcess } from '../../application/port/FinanceJobProcess';
import { Settlement, type SettlementValue } from '../../domain/model/Settlement';
import { InputWatermark } from '../../domain/value/InputWatermark';
import { financeFingerprint } from '../../domain/value/FinanceFingerprint';
import { PgPayoutProcess } from './PgPayoutProcess';
import type { FinanceOrderPort } from '../../../order/public';
import type { FinancePaymentPort } from '../../../payment/public';

export async function assertVerifiedSources(context: Parameters<FinancePaymentPort['orders']>[0], lines: readonly SettlementSourceLine[], payments: FinancePaymentPort, orders: FinanceOrderPort): Promise<void> {
  const paymentIds = distinct(lines.filter(({ internal_type }) => internal_type === 'payment').flatMap(({ internal_id }) => (internal_id ? [internal_id] : [])));
  const paymentOrders = await payments.orders(context, paymentIds);
  if (new Set(paymentOrders.map(({ payment }) => payment)).size !== paymentIds.length) throw new Error('SETTLEMENT_NOT_RUNNABLE');
  const orderIds = distinct([...lines.filter(({ internal_type }) => internal_type === 'order').flatMap(({ internal_id }) => (internal_id ? [internal_id] : [])), ...paymentOrders.map(({ order }) => order)]);
  if (new Set(await orders.verified(context, orderIds)).size !== orderIds.length) throw new Error('SETTLEMENT_NOT_RUNNABLE');
}

export function distinct(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export async function findSettlement(client: SqlExecutor, reconciliation: string, partner: string, period: string): Promise<ExistingSettlement | undefined> {
  const result = await client.query<ExistingSettlement>(
    `select id,scope_id,partner_id,period,reconciliation_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,invoice_basis,input_hash,input_count,
    input_minor::float8 input_minor,input_watermark
    from finance.settlement where reconciliation_id=$1 or (partner_id=$2 and period=$3) order by id limit 1 for update`,
    [reconciliation, partner, period]
  );
  return result.rows[0];
}

export async function findSettlementByReconciliation(client: SqlExecutor, reconciliation: string): Promise<ExistingSettlement | undefined> {
  const result = await client.query<ExistingSettlement>(
    `select id,scope_id,partner_id,period,reconciliation_id,amount_minor::float8 amount_minor,
    gross_minor::float8 gross_minor,fee_minor::float8 fee_minor,currency,invoice_basis,input_hash,input_count,
    input_minor::float8 input_minor,input_watermark from finance.settlement where reconciliation_id=$1 for update`,
    [reconciliation]
  );
  return result.rows[0];
}

export function assertFrozenSettlement(existing: ExistingSettlement, business: string, reconciliation: string): void {
  InputWatermark.restore({ hash: existing.input_hash, count: Number(existing.input_count), occurredAt: new Date(existing.input_watermark).toISOString() });
  if (existing.id !== business || existing.reconciliation_id !== reconciliation) throw new Error('SETTLEMENT_BUSINESS_NUMBER_CONFLICT');
}

export function assertSettlement(existing: ExistingSettlement, proposal: SettlementValue, watermark: InputWatermark): void {
  watermark.assert(existing.input_hash, Number(existing.input_count));
  if (
    existing.id !== proposal.id ||
    existing.scope_id !== proposal.scopeId ||
    existing.partner_id !== proposal.partnerId ||
    existing.period !== proposal.period ||
    existing.reconciliation_id !== proposal.reconciliationId ||
    existing.currency !== proposal.currency ||
    Number(existing.gross_minor) !== proposal.grossMinor ||
    Number(existing.fee_minor) !== proposal.feeMinor ||
    Number(existing.amount_minor) !== proposal.amountMinor ||
    existing.invoice_basis !== proposal.invoiceBasis
  )
    throw new Error('SETTLEMENT_INPUT_SNAPSHOT_CHANGED');
}

export async function assertSettlementTotals(client: SqlExecutor, settlement: string, count: number, inputMinor: number): Promise<void> {
  const result = await client.query<{ line_count: number; line_total: number; split_total: number; current_gross: number }>(
    `select count(line.id) filter(where line.adjustment_of is null)::float8 line_count,
    coalesce(sum(case when line.direction='decrease' then -line.amount_minor else line.amount_minor end)
      filter(where line.adjustment_of is null),0)::float8 line_total,
    (select coalesce(sum(amount_minor),0)::float8 from finance.split where settlement_id=$1) split_total,
    settlement.gross_minor::float8 current_gross from finance.settlement settlement
    left join finance.settlementline line on line.settlement_id=settlement.id where settlement.id=$1 group by settlement.gross_minor`,
    [settlement]
  );
  const total = result.rows[0];
  if (!total || Number(total.line_count) !== count || Number(total.line_total) !== inputMinor || Number(total.split_total) !== Number(total.current_gross)) throw new Error('SETTLEMENT_FROZEN_TOTAL_MISMATCH');
}

export function settlementHash(id: string, basis: SettlementBasis, lines: readonly SettlementSourceLine[]): string {
  const serialized = lines.map((line) => [line.id, line.internal_type ?? '', line.internal_id ?? '', line.internal_minor, line.version, line.external_reference, line.kind, line.tax_minor, line.raw_hash].join('\u001f')).join('\u001e');
  return financeFingerprint([id, basis.scope_id, basis.partner_id, basis.period, basis.credit_minor, basis.statement_hash, basis.version, basis.rule_text, serialized]);
}

export function options(execution: FinanceJobExecution) {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:settlement',
    trace: execution.trace,
    operation: 'job.finance.settlement',
    workload: 'jobs' as const,
    signal: execution.signal,
    deadline: execution.deadline,
  };
}

export interface SettlementBasis {
  readonly scope_id: string;
  readonly partner_id: string;
  readonly period: string;
  readonly credit_minor: number;
  readonly created_by: string;
  readonly statement_hash: string;
  readonly version: number;
  readonly updated_at: string;
  readonly rule: unknown;
  readonly rule_text: string;
}
export interface SettlementSourceLine {
  readonly id: string;
  readonly internal_type: string | null;
  readonly internal_id: string | null;
  readonly internal_minor: number;
  readonly version: number;
  readonly external_reference: string;
  readonly kind: string;
  readonly tax_minor: number;
  readonly raw_hash: string;
}
export interface ExistingSettlement {
  readonly id: string;
  readonly scope_id: string;
  readonly partner_id: string;
  readonly period: string;
  readonly reconciliation_id: string;
  readonly amount_minor: number;
  readonly gross_minor: number;
  readonly fee_minor: number;
  readonly currency: string;
  readonly invoice_basis: 'gross' | 'net';
  readonly input_hash: string;
  readonly input_count: number;
  readonly input_minor: number;
  readonly input_watermark: string;
}
