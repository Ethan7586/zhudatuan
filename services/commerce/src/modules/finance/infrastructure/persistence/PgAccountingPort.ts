import { Money } from '@shop/kernel';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccountCommand, AccountingPort, HoldCommand, PostingCommand } from '../../public/AccountingPort';
import { Account } from '../../domain/model/Account';
import { AccountingPeriod } from '../../domain/model/AccountingPeriod';
import { Journal } from '../../domain/model/Journal';
import { JournalEntry } from '../../domain/model/JournalEntry';
import { Ledger } from '../../domain/model/Ledger';
import { AccountingDate } from '../../domain/value/AccountingDate';
import { PostingReference } from '../../domain/value/PostingReference';

/** Finance-owned implementation of the standard accounting command boundary. */
export class PgAccountingPort implements AccountingPort {
  private readonly transactions = new PgTransactionAccess();

  async post(context: WriteTransactionContext, command: PostingCommand): Promise<string> {
    const database = this.transactions.database(context);
    if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) throw new Error('FINANCE_POST_AMOUNT_INVALID');
    if (command.currency !== 'CNY') throw new Error('FINANCE_CURRENCY_UNSUPPORTED');
    const occurredAt = AccountingDate.of(command.occurredAt ?? new Date().toISOString());
    const reference = PostingReference.of(command.source);
    const debit = Account.create(`account:${command.debit.code}`, command.scopeId, command.debit.code, command.currency, command.debit.kind);
    const credit = Account.create(`account:${command.credit.code}`, command.scopeId, command.credit.code, command.currency, command.credit.kind);
    const draft = Journal.draft({
      id: `journal:${reference.value.eventId}:${reference.value.leg}`,
      scopeId: command.scopeId,
      reference,
      description: command.description,
      entries: [
        JournalEntry.create('entry:debit', debit, 'debit', Money.of(command.amountMinor), occurredAt),
        JournalEntry.create('entry:credit', credit, 'credit', Money.of(command.amountMinor), occurredAt),
      ],
    });
    Ledger.empty(command.scopeId, [debit, credit]).post(draft, AccountingPeriod.open(command.scopeId, occurredAt.period), occurredAt);
    const result = await database.query<{ journal: string }>(`select finance.post($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::timestamptz) journal`, [
      command.scopeId, reference.value.event, reference.value.aggregateId, command.currency, command.description,
      command.debit.code, command.debit.kind, command.credit.code, command.credit.kind, command.amountMinor, occurredAt.instant,
    ]);
    const journal = result.rows[0]?.journal;
    if (!journal) throw new Error('FINANCE_POST_FAILED');
    await database.query(
      `insert into finance.economicleg(owner_event_id,economic_leg_id,journal_id,scope_id,currency,amount_minor,posted_at)
      values($1,$2,$3,$4,$5,$6,$7::timestamptz) on conflict(owner_event_id,economic_leg_id) do nothing`,
      [reference.value.eventId, reference.value.leg, journal, command.scopeId, command.currency, command.amountMinor, occurredAt.instant]
    );
    const leg = await database.query(
      `select 1 from finance.economicleg where owner_event_id=$1 and economic_leg_id=$2 and journal_id=$3
      and scope_id=$4 and currency=$5 and amount_minor=$6`,
      [reference.value.eventId, reference.value.leg, journal, command.scopeId, command.currency, command.amountMinor]
    );
    if (!leg.rows[0]) throw new Error('FINANCE_ECONOMIC_LEG_CONFLICT');
    return journal;
  }

  async ensureAccount(context: WriteTransactionContext, command: AccountCommand): Promise<string> {
    const database = this.transactions.database(context);
    if (command.currency !== 'CNY') throw new Error('FINANCE_CURRENCY_UNSUPPORTED');
    Account.create(`account:${command.code}`, command.scopeId, command.code, command.currency, command.kind);
    const result = await database.query<{ id: string }>('select finance.ensure_account($1,$2,$3,$4) id', [command.scopeId, command.code, command.currency, command.kind]);
    const id = result.rows[0]?.id;
    if (!id) throw new Error('FINANCE_ACCOUNT_FAILED');
    return id;
  }

  async hold(context: WriteTransactionContext, command: HoldCommand): Promise<string> {
    const database = this.transactions.database(context);
    if (!Number.isSafeInteger(command.amountMinor) || command.amountMinor <= 0) throw new Error('FINANCE_HOLD_AMOUNT_INVALID');
    Account.create(`account:${command.account.code}`, command.scopeId, command.account.code, command.account.currency, command.account.kind);
    AccountingDate.of(command.expiresAt);
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
      [command.scopeId, command.account.code, command.account.currency, command.account.kind, command.ownerType, command.ownerId, command.amountMinor, command.expiresAt]
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error('FINANCE_HOLD_INSUFFICIENT_OR_CONFLICT');
    return id;
  }

  async capture(context: WriteTransactionContext, holdId: string, command: PostingCommand): Promise<string> {
    const database = this.transactions.database(context);
    const selected = await database.query(
      `update finance.hold set state='captured',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and state='active' and expires_at>clock_timestamp() and amount_minor=$3 returning id`,
      [holdId, command.scopeId, command.amountMinor]
    );
    if (!selected.rows[0]) throw new Error('FINANCE_HOLD_NOT_CAPTURABLE');
    return this.post(context, command);
  }

  async release(context: WriteTransactionContext, holdId: string, scopeId: string): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update finance.hold set state=case when expires_at<=clock_timestamp() then 'expired' else 'released' end,
      updated_at=clock_timestamp() where id=$1 and scope_id=$2 and state='active' returning id`,
      [holdId, scopeId]
    );
    if (!result.rows[0]) throw new Error('FINANCE_HOLD_NOT_RELEASABLE');
  }
}
