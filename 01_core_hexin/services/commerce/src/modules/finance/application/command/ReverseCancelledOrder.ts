import { FinancePort } from '../../FinancePort';

interface Database {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

interface CancelledOrderFact extends Record<string, unknown> {
  readonly scope_id: string;
  readonly currency: string;
  readonly total_minor: string;
  readonly lifecycle_state: string;
  readonly tenders: unknown;
}

interface AccrualFact extends Record<string, unknown> {
  readonly id: string;
  readonly currency: string;
  readonly entry_count: number;
  readonly receivable_minor: string;
  readonly revenue_minor: string;
}

/** Reverses only the immutable external-tender accrual created by order.placed. */
export class ReverseCancelledOrder {
  private readonly finance = new FinancePort();

  async execute(database: Database, payload: Readonly<Record<string, unknown>>, target: Readonly<{ scope_id: string; occurred_at: string }>): Promise<void> {
    const order = requiredText(payload.order, 'FINANCE_ORDER_REFERENCE_REQUIRED');
    const reason = requiredText(payload.reason, 'FINANCE_ORDER_CANCELLATION_REASON_REQUIRED');
    const selected = await database.query<CancelledOrderFact>(
      `select orders.scope_id,orders.currency,orders.total_minor::text total_minor,orders.lifecycle_state,
      coalesce(jsonb_agg(jsonb_build_object('kind',tender.kind,'amountMinor',tender.amount_minor::text)
        order by tender.sequence) filter(where tender.sequence is not null),'[]'::jsonb) tenders
      from ordering.orderrecord orders left join payment.intent intent on intent.order_id=orders.id
      left join payment.intenttender tender on tender.intent_id=intent.id where orders.id=$1 group by orders.id`,
      [order]
    );
    const source = selected.rows[0];
    if (!source || source.scope_id !== target.scope_id || source.lifecycle_state !== 'cancelled') {
      throw new Error('FINANCE_ORDER_CANCELLATION_EVIDENCE_MISMATCH');
    }
    const total = databaseInteger(source.total_minor, 'FINANCE_ORDER_AMOUNT_INVALID');
    const tenders = tenderSummary(source.tenders);
    if (tenders.total !== total || tenders.externalCount > 1) throw new Error('FINANCE_ORDER_TENDER_ALLOCATION_INVALID');
    const accrual = await database.query<AccrualFact>(
      `select journal.id,journal.currency,count(entry.id)::integer entry_count,
      coalesce(sum(entry.amount_minor) filter(where entry.side='debit' and account.code=$3 and account.kind='asset'),0)::text receivable_minor,
      coalesce(sum(entry.amount_minor) filter(where entry.side='credit' and account.code='commerce.revenue' and account.kind='income'),0)::text revenue_minor
      from finance.journal journal join finance.entry entry on entry.journal_id=journal.id
      join finance.account account on account.id=entry.account_id
      where journal.scope_id=$1 and journal.reference_type='order.placed' and journal.reference_id=$2 and journal.state='posted'
      group by journal.id`,
      [target.scope_id, order, `order.receivable.${order}`]
    );
    const journal = accrual.rows[0];
    if (tenders.external === 0) {
      if (journal) throw new Error('FINANCE_ORDER_ACCRUAL_UNEXPECTED');
      return;
    }
    if (
      !journal ||
      journal.currency !== source.currency ||
      journal.entry_count !== 2 ||
      databaseInteger(journal.receivable_minor, 'FINANCE_ORDER_ACCRUAL_INVALID') !== tenders.external ||
      databaseInteger(journal.revenue_minor, 'FINANCE_ORDER_ACCRUAL_INVALID') !== tenders.external
    ) {
      throw new Error('FINANCE_ORDER_ACCRUAL_MISSING_OR_INVALID');
    }
    await this.finance.reverse(database, {
      scope: target.scope_id,
      journal: journal.id,
      referenceId: `order.cancelled:${order}`,
      reason: `Order cancelled: ${reason}`,
      actor: 'system:reconciliation',
      occurredAt: target.occurred_at,
    });
  }
}

function tenderSummary(value: unknown): Readonly<{ total: number; external: number; externalCount: number }> {
  if (!Array.isArray(value)) throw new Error('FINANCE_ORDER_TENDERS_INVALID');
  let total = 0;
  let external = 0;
  let externalCount = 0;
  for (const candidate of value) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('FINANCE_ORDER_TENDERS_INVALID');
    const tender = candidate as Readonly<Record<string, unknown>>;
    const kind = requiredText(tender.kind, 'FINANCE_ORDER_TENDER_KIND_INVALID');
    if (!['wechat', 'benefit', 'voucher'].includes(kind)) throw new Error('FINANCE_ORDER_TENDER_KIND_INVALID');
    const amount = databaseInteger(tender.amountMinor, 'FINANCE_ORDER_TENDER_AMOUNT_INVALID');
    total = safeAdd(total, amount);
    if (kind === 'wechat') {
      external = safeAdd(external, amount);
      externalCount += 1;
    }
  }
  return Object.freeze({ total, external, externalCount });
}

function databaseInteger(value: unknown, code: string): number {
  if ((typeof value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(value)) && !Number.isSafeInteger(value)) throw new Error(code);
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}
function safeAdd(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) throw new Error('FINANCE_ORDER_TENDER_TOTAL_OVERFLOW');
  return sum;
}
function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}
