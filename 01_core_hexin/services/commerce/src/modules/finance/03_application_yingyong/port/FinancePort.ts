import { Money } from '@shop/kernel';
import { PostingPolicy } from '../../02_domain_yewu/policy/PostingPolicy';

export interface PostingIntent {
  readonly scope: string;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly currency: string;
  readonly description: string;
  readonly debit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly credit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly amountMinor: number;
  readonly occurredAt?: string;
}

export interface ReversalIntent {
  readonly scope: string;
  readonly journal: string;
  readonly referenceId: string;
  readonly reason: string;
  readonly actor: string;
  readonly occurredAt: string;
}

interface FinanceDatabase {
  query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<Readonly<{ rows: readonly R[] }>>;
}

export interface HoldIntent {
  readonly scope: string;
  readonly account: Readonly<{ code: string; currency: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly amountMinor: number;
  readonly expiresAt: string;
}

/** Public accounting boundary. Callers submit facts; only Finance builds balanced journals and entries. */
export class FinancePort {
  private readonly policy = new PostingPolicy();

  async post(database: FinanceDatabase, intent: PostingIntent): Promise<string> {
    if (!Number.isSafeInteger(intent.amountMinor) || intent.amountMinor <= 0) throw new Error('FINANCE_POST_AMOUNT_INVALID');
    if (intent.currency !== 'CNY') throw new Error('FINANCE_CURRENCY_UNSUPPORTED');
    this.policy.assertBalanced([
      { side: 'debit', amount: Money.of(intent.amountMinor) },
      { side: 'credit', amount: Money.of(intent.amountMinor) },
    ]);
    const result = await database.query<{ journal: string }>(`select finance.post($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz) journal`, [
      intent.scope,
      intent.referenceType,
      intent.referenceId,
      intent.currency,
      intent.description,
      intent.debit.code,
      intent.debit.kind,
      intent.credit.code,
      intent.credit.kind,
      intent.amountMinor,
      intent.occurredAt ?? new Date().toISOString(),
    ]);
    const journal = result.rows[0]?.journal;
    if (!journal) throw new Error('FINANCE_POST_FAILED');
    return journal;
  }

  async account(database: FinanceDatabase, scope: string, code: string, currency: string, kind: 'asset' | 'liability' | 'income' | 'expense'): Promise<string> {
    if (currency !== 'CNY') throw new Error('FINANCE_CURRENCY_UNSUPPORTED');
    const result = await database.query<{ id: string }>('select finance.ensure_account($1,$2,$3,$4) id', [scope, code, currency, kind]);
    const id = result.rows[0]?.id;
    if (!id) throw new Error('FINANCE_ACCOUNT_FAILED');
    return id;
  }

  async recordSupplierOrder(database: FinanceDatabase, order: string): Promise<void> {
    const legs = (await database.query<SupplierLeg>(`select leg.id,leg.order_id,orders.scope_id,leg.transaction_id,leg.correlation_id,
      leg.route_id,leg.route_version::float8 route_version,leg.supplier_id,leg.amount_minor::float8 amount_minor,
      leg.cost_minor::float8 cost_minor,leg.currency,orders.created_at::text occurred_at
      from ordering.suborder leg join ordering.orderrecord orders on orders.id=leg.order_id
      where leg.order_id=$1 and leg.transaction_id is not null order by leg.id`, [order])).rows;
    for (const leg of legs) {
      const saleJournal = leg.amount_minor > 0 ? await this.post(database, {
        scope: leg.scope_id, referenceType: 'supplier-leg.sale', referenceId: leg.id, currency: leg.currency,
        description: `Supplier leg sale ${leg.id}`, debit: { code: `order.receivable.${leg.order_id}`, kind: 'asset' },
        credit: { code: 'commerce.revenue', kind: 'income' }, amountMinor: leg.amount_minor, occurredAt: leg.occurred_at,
      }) : null;
      const costJournal = leg.cost_minor > 0 ? await this.post(database, {
        scope: leg.scope_id, referenceType: 'supplier-leg.cost', referenceId: leg.id, currency: leg.currency,
        description: `Supplier leg cost ${leg.id}`, debit: { code: 'settlement.cost', kind: 'expense' },
        credit: { code: `settlement.payable.${leg.supplier_id}`, kind: 'liability' }, amountMinor: leg.cost_minor, occurredAt: leg.occurred_at,
      }) : null;
      await database.query(`insert into finance.supplierlegfact(id,order_id,supplier_leg_id,transaction_id,correlation_id,route_id,
        route_version,supplier_id,fact_kind,amount_minor,currency,journal_id,created_at) values
        ($1||':receivable',$2,$1,$3,$4,$5,$6,$7,'receivable',$8,$9,$10,clock_timestamp()),
        ($1||':income',$2,$1,$3,$4,$5,$6,$7,'income',$8,$9,$10,clock_timestamp()),
        ($1||':payable',$2,$1,$3,$4,$5,$6,$7,'payable',$11,$9,$12,clock_timestamp()),
        ($1||':cost',$2,$1,$3,$4,$5,$6,$7,'cost',$11,$9,$12,clock_timestamp())
        on conflict(supplier_leg_id,fact_kind) do nothing`, [leg.id, leg.order_id, leg.transaction_id, leg.correlation_id,
        leg.route_id, leg.route_version, leg.supplier_id, leg.amount_minor, leg.currency, saleJournal, leg.cost_minor, costJournal]);
    }
  }

  async reverseSupplierAftersale(database: FinanceDatabase, aftersale: string, refund: string): Promise<void> {
    const target = (await database.query<SupplierRefundTarget>(`select aftersale.id aftersale_id,aftersale.order_id,line.id order_line_id,
      line.supplier_leg_id,line.supplier_id,orders.scope_id,orders.transaction_id,orders.correlation_id,orders.currency,
      aftersale.created_at::text occurred_at,
      allocation.amount_minor::float8 amount_minor,line.payable_minor::float8 line_payable_minor,line.cost_minor::float8 line_cost_minor,
      coalesce((select sum(previous.amount_minor) from finance.supplierlegreversal previous
        where previous.order_line_id=line.id and previous.fact_kind='receivable'),0)::float8 reversed_amount_minor,
      coalesce((select sum(previous.amount_minor) from finance.supplierlegreversal previous
        where previous.order_line_id=line.id and previous.fact_kind='cost'),0)::float8 reversed_cost_minor
      from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join ordering.line line on line.id=aftersale.line_id and line.order_id=orders.id
      join payment.supplierrefundallocation allocation on allocation.aftersale_id=aftersale.id and allocation.refund_id=$2
      where aftersale.id=$1`, [aftersale, refund])).rows[0];
    if (!target) throw new Error('SUPPLIER_AFTERSALE_FINANCE_TARGET_MISSING');
    const remainingCost = target.line_cost_minor-target.reversed_cost_minor;
    const costMinor = target.reversed_amount_minor+target.amount_minor >= target.line_payable_minor
      ? remainingCost
      : Math.min(remainingCost, Math.floor(target.line_cost_minor*target.amount_minor/target.line_payable_minor));
    const saleJournal = await this.post(database, {
      scope: target.scope_id, referenceType: 'supplier-leg.refund-sale', referenceId: aftersale, currency: target.currency,
      description: `Supplier leg refund ${aftersale}`, debit: { code: 'commerce.refund', kind: 'expense' },
      credit: { code: `order.receivable.${target.order_id}`, kind: 'asset' }, amountMinor: target.amount_minor, occurredAt: target.occurred_at,
    });
    const costJournal = costMinor > 0 ? await this.post(database, {
      scope: target.scope_id, referenceType: 'supplier-leg.refund-cost', referenceId: aftersale, currency: target.currency,
      description: `Supplier leg refund cost ${aftersale}`, debit: { code: `settlement.payable.${target.supplier_id}`, kind: 'liability' },
      credit: { code: 'settlement.cost', kind: 'expense' }, amountMinor: costMinor, occurredAt: target.occurred_at,
    }) : null;
    await database.query(`insert into finance.supplierlegreversal(id,aftersale_id,order_line_id,supplier_leg_id,transaction_id,
      correlation_id,fact_kind,amount_minor,currency,journal_id,created_at) values
      ($1||':receivable',$1,$2,$3,$4,$5,'receivable',$6,$7,$8,clock_timestamp()),
      ($1||':income',$1,$2,$3,$4,$5,'income',$6,$7,$8,clock_timestamp()),
      ($1||':payable',$1,$2,$3,$4,$5,'payable',$9,$7,$10,clock_timestamp()),
      ($1||':cost',$1,$2,$3,$4,$5,'cost',$9,$7,$10,clock_timestamp())
      on conflict(aftersale_id,order_line_id,fact_kind) do nothing`, [target.aftersale_id,target.order_line_id,
      target.supplier_leg_id,target.transaction_id,target.correlation_id,target.amount_minor,target.currency,saleJournal,costMinor,costJournal]);
  }

  async reverse(database: FinanceDatabase, intent: ReversalIntent): Promise<string> {
    if (!intent.scope || !intent.journal || !intent.referenceId || !intent.reason || !intent.actor || Number.isNaN(Date.parse(intent.occurredAt))) {
      throw new Error('FINANCE_REVERSAL_INVALID');
    }
    const result = await database.query<{ journal: string }>('select finance.reverse($1,$2,$3,$4,$5,$6::timestamptz) journal', [intent.scope, intent.journal, intent.referenceId, intent.reason, intent.actor, intent.occurredAt]);
    const journal = result.rows[0]?.journal;
    if (!journal) throw new Error('FINANCE_REVERSAL_FAILED');
    return journal;
  }

  async hold(database: FinanceDatabase, intent: HoldIntent): Promise<string> {
    if (!Number.isSafeInteger(intent.amountMinor) || intent.amountMinor <= 0) throw new Error('FINANCE_HOLD_AMOUNT_INVALID');
    const result = await database.query<{ id: string }>(
      `with account as(select finance.ensure_account($1,$2,$3,$4) id),available as(
        select account.id,coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)
          -coalesce((select sum(hold.amount_minor) from finance.hold hold where hold.account_id=account.id and hold.state='active'
            and hold.expires_at>clock_timestamp()),0) amount from account left join finance.entry entry on entry.account_id=account.id group by account.id)
      insert into finance.hold(id,scope_id,account_id,owner_type,owner_id,amount_minor,state,expires_at,created_at,updated_at)
      select 'hold:'||encode(public.digest($1||':'||$2||':'||$5||':'||$6,'sha256'),'hex'),$1,available.id,$5,$6,$7,'active',$8,
        clock_timestamp(),clock_timestamp() from available where available.amount>=$7
      on conflict(account_id,owner_type,owner_id) do update set amount_minor=excluded.amount_minor,state='active',expires_at=excluded.expires_at,
        updated_at=clock_timestamp() where finance.hold.state in('released','expired') returning id`,
      [intent.scope, intent.account.code, intent.account.currency, intent.account.kind, intent.ownerType, intent.ownerId, intent.amountMinor, intent.expiresAt]
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('FINANCE_HOLD_INSUFFICIENT_OR_CONFLICT');
    return id;
  }

  async capture(database: FinanceDatabase, hold: string, posting: PostingIntent): Promise<string> {
    const selected = await database.query<{ amount_minor: number }>(
      `update finance.hold set state='captured',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and state='active' and expires_at>clock_timestamp() and amount_minor=$3 returning amount_minor::float8 amount_minor`,
      [hold, posting.scope, posting.amountMinor]
    );
    if (!selected.rows[0]) throw new Error('FINANCE_HOLD_NOT_CAPTURABLE');
    return this.post(database, posting);
  }

  async release(database: FinanceDatabase, hold: string, scope: string): Promise<void> {
    const result = await database.query(
      `update finance.hold set state=case when expires_at<=clock_timestamp() then 'expired' else 'released' end,
      updated_at=clock_timestamp() where id=$1 and scope_id=$2 and state='active' returning id`,
      [hold, scope]
    );
    if (!result.rows[0]) throw new Error('FINANCE_HOLD_NOT_RELEASABLE');
  }

  async receiveReconciliation(database: FinanceDatabase, input: Readonly<{ id: string; scope: string; provider: string; partner: string; period: string; statement: string; hash: string; run: string }>): Promise<void> {
    await database.query(
      `insert into finance.reconciliation(id,scope_id,provider,partner_id,period,statement_ref,statement_hash,state,created_by,evidence)
      values($1,$2,$3,$4,$5,$6,$7,'received','system',jsonb_build_object('syncrun',$8))
      on conflict(scope_id,provider,period,statement_hash) do nothing`,
      [input.id, input.scope, input.provider, input.partner, input.period, input.statement, input.hash, input.run]
    );
  }
}

interface SupplierLeg extends Record<string, unknown> {
  readonly id: string; readonly order_id: string; readonly scope_id: string; readonly transaction_id: string;
  readonly correlation_id: string; readonly route_id: string; readonly route_version: number; readonly supplier_id: string;
  readonly amount_minor: number; readonly cost_minor: number; readonly currency: string; readonly occurred_at: string;
}

interface SupplierRefundTarget extends Record<string, unknown> {
  readonly aftersale_id: string; readonly order_id: string; readonly order_line_id: string; readonly supplier_leg_id: string;
  readonly supplier_id: string;
  readonly scope_id: string; readonly transaction_id: string; readonly correlation_id: string; readonly currency: string;
  readonly occurred_at: string;
  readonly amount_minor: number; readonly line_payable_minor: number; readonly line_cost_minor: number;
  readonly reversed_amount_minor: number; readonly reversed_cost_minor: number;
}
