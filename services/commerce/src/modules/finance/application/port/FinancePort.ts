import { Money } from '@shop/kernel';
import { PostingPolicy } from '../../domain/policy/PostingPolicy';

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
