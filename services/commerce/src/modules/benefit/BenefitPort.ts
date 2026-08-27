import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
import { FinancePort } from '../finance/FinanceModule';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { FinancePort } from '../finance/FinanceModule';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import type { BenefitChoice, BenefitGateway, BenefitRefund, BenefitTender } from './application/port/BenefitPort';

export type { BenefitChoice, BenefitRefund, BenefitTender } from './application/port/BenefitPort';

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
interface FinancialPosting {
  post(database: OperationDatabase, intent: Readonly<{
    scope: string;
    referenceType: string;
    referenceId: string;
    currency: string;
    description: string;
    debit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    credit: Readonly<{ code: string; kind: 'asset' | 'liability' | 'income' | 'expense' }>;
    amountMinor: number;
    occurredAt?: string;
  }>): Promise<string>;
}

<<<<<<< HEAD
export class BenefitPort implements BenefitGateway {
  constructor(private readonly finance?: FinancialPosting) {}
=======
export class BenefitPort implements BenefitGateway {
  constructor(private readonly finance = new FinancePort()) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export class BenefitPort implements BenefitGateway {
  constructor(private readonly finance?: FinancialPosting) {}
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
export class BenefitPort implements BenefitGateway {
  constructor(private readonly finance = new FinancePort()) {}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  async preview(database: OperationDatabase, member: string, scope: string, accounts: readonly string[]): Promise<readonly BenefitChoice[]> {
    if (accounts.length === 0) return [];
    return (await database.query<BenefitChoice>(`select account.id,account.version::float8 version,account.kind,
      greatest(0,least(balance.balance_minor,coalesce((select sum(lot.remaining_minor) from benefit.lot lot where lot.account_id=account.id
        and lot.state='active' and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0))
        -coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation where reservation.account_id=account.id
          and reservation.state='active' and reservation.expires_at>clock_timestamp()),0))::float8 available_minor
      from benefit.account account join benefit.balance balance on balance.account_id=account.id where account.id=any($1::text[])
      and account.member_id=$2 and account.scope_id=$3 and account.currency='CNY' and account.status='active' order by account.id`,
    [accounts, member, scope])).rows;
  }

  async reserve(database: OperationDatabase, order: string, member: string, scope: string, tenders: readonly BenefitTender[]): Promise<void> {
    if (tenders.length === 0) return;
    const ids = tenders.map(({ reference }) => reference);
    const rows = await database.query<{ id: string; available_minor: number }>(`select account.id,
      greatest(0,least(balance.balance_minor,coalesce((select sum(lot.remaining_minor) from benefit.lot lot where lot.account_id=account.id
        and lot.state='active' and lot.effective_at<=clock_timestamp() and (lot.expires_at is null or lot.expires_at>clock_timestamp())),0))
        -coalesce((select sum(reservation.amount_minor) from benefit.reservation reservation where reservation.account_id=account.id
          and reservation.state='active' and reservation.expires_at>clock_timestamp()),0))::float8 available_minor
      from benefit.account account join benefit.balance balance on balance.account_id=account.id where account.id=any($1::text[])
      and account.member_id=$2 and account.scope_id=$3 and account.status='active' order by account.id for update of account`, [ids, member, scope]);
    if (rows.rows.length !== tenders.length) throw new Error('BENEFIT_ACCOUNT_NOT_USABLE');
    for (const tender of tenders) {
      const account = rows.rows.find(({ id }) => id === tender.reference)!;
      if (account.available_minor < tender.amountMinor) throw new Error('BENEFIT_BALANCE_INSUFFICIENT');
      await database.query(`insert into benefit.reservation(id,account_id,owner_id,amount_minor,state,expires_at)
        values($1,$2,$3,$4,'active',clock_timestamp()+interval '30 minutes')`,
      [`benefitreserve:${randomUUID()}`, account.id, order, tender.amountMinor]);
    }
  }

  async consume(database: OperationDatabase, order: string, accountid: string, amountMinor: number): Promise<void> {
    const account = await database.query<{ id: string; scope_id: string; currency: string }>(`select id,scope_id,currency from benefit.account
      where id=$1 and status='active' for update`, [accountid]);
    const selected = account.rows[0];
    if (!selected) throw new Error('BENEFIT_ACCOUNT_NOT_USABLE');
    const reservation = await database.query(`select id from benefit.reservation where account_id=$1 and owner_id=$2 and state='active'
      and expires_at>clock_timestamp() and amount_minor=$3 for update`, [accountid, order, amountMinor]);
    if (!reservation.rows[0]) throw new Error('BENEFIT_HOLD_MISSING');
    const lots = await database.query<{ id: string; remaining_minor: number }>(`select id,remaining_minor::float8 remaining_minor from benefit.lot
      where account_id=$1 and state='active' and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp())
      order by expires_at nulls last,effective_at,id for update`, [accountid]);
    if (lots.rows.reduce((sum, lot) => sum+lot.remaining_minor, 0) < amountMinor) throw new Error('BENEFIT_BALANCE_INSUFFICIENT');
    let remaining = amountMinor;
    for (const lot of lots.rows) {
      const amount = Math.min(remaining, lot.remaining_minor);
      if (amount === 0) continue;
      await database.query(`update benefit.lot set remaining_minor=remaining_minor-$2,
        state=case when remaining_minor=$2 then 'consumed' else 'active' end,version=version+1 where id=$1`, [lot.id, amount]);
      await database.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
        values($1,$2,'consume',$3,'order',$4,clock_timestamp())`, [`movement:${randomUUID()}`, lot.id, amount, order]);
      remaining -= amount;
      if (remaining === 0) break;
    }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await this.financial().post(database, { scope: selected.scope_id, referenceType: 'benefit.consume', referenceId: `${selected.id}:${order}`,
=======
    await this.finance.post(database, { scope: selected.scope_id, referenceType: 'benefit.consume', referenceId: `${selected.id}:${order}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await this.financial().post(database, { scope: selected.scope_id, referenceType: 'benefit.consume', referenceId: `${selected.id}:${order}`,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    await this.finance.post(database, { scope: selected.scope_id, referenceType: 'benefit.consume', referenceId: `${selected.id}:${order}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      currency: selected.currency, description: 'Benefit order consumption', debit: { code: `benefit.${selected.id}`, kind: 'liability' },
      credit: { code: 'commerce.benefit', kind: 'income' }, amountMinor });
    await database.query(`update benefit.reservation set state='consumed' where id=$1`, [reservation.rows[0].id]);
  }

  async refund(database: OperationDatabase, input: BenefitRefund): Promise<void> {
    const account = await database.query<{ id: string; currency: string }>(`select id,currency from benefit.account
      where id=$1 and member_id=$2 and scope_id=$3 for update`, [input.account, input.member, input.scope]);
    const selected = account.rows[0];
    if (!selected) throw new Error('BENEFIT_REFUND_ACCOUNT_MISSING');
    const sources = await database.query<Source>(`select movement.id,movement.lot_id,movement.amount_minor::float8 amount_minor,
      coalesce((select sum(restored.amount_minor) from benefit.lotmovement restored where restored.source_id=movement.id and restored.kind='refund'),0)::float8 restored_minor,
      lot.batch_id,lot.member_id,lot.state,lot.expires_at from benefit.lotmovement movement join benefit.lot lot on lot.id=movement.lot_id
      where movement.kind='consume' and movement.reference_type='order' and movement.reference_id=$1 and lot.account_id=$2
      order by movement.occurred_at,movement.id for update of lot`, [input.order, input.account]);
    if (sources.rows.reduce((sum, source) => sum+source.amount_minor-source.restored_minor, 0) < input.amountMinor) throw new Error('BENEFIT_REFUND_EXCEEDS_CONSUMPTION');
    let remaining = input.amountMinor;
    for (const source of sources.rows) {
      const amount = Math.min(remaining, source.amount_minor-source.restored_minor);
      if (amount <= 0) continue;
      const reusable = !['expired', 'revoked'].includes(source.state) && (source.expires_at === null || new Date(source.expires_at).getTime() > Date.now());
      let target = source.lot_id;
      if (reusable) await database.query(`update benefit.lot set remaining_minor=remaining_minor+$2,state='active',version=version+1
        where id=$1 and remaining_minor+$2<=total_minor`, [source.lot_id, amount]);
      else {
        target = `lot:refund:${input.id}:${source.id}`;
        await database.query(`insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,origin,version)
          values($1,$2,$3,$4,$5,$5,'active',clock_timestamp(),clock_timestamp()+interval '30 days','refund',0) on conflict(id) do nothing`,
        [target, input.account, source.batch_id, source.member_id, amount]);
      }
      await database.query(`insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,source_id,occurred_at)
        values($1,$2,'refund',$3,'refund',$4,$5,clock_timestamp())`, [`movement:${randomUUID()}`, target, amount, input.id, source.id]);
      remaining -= amount;
      if (remaining === 0) break;
    }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    await this.financial().post(database, { scope: input.scope, referenceType: 'benefit.refund', referenceId: `${selected.id}:${input.id}`,
=======
    await this.finance.post(database, { scope: input.scope, referenceType: 'benefit.refund', referenceId: `${selected.id}:${input.id}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    await this.financial().post(database, { scope: input.scope, referenceType: 'benefit.refund', referenceId: `${selected.id}:${input.id}`,
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    await this.finance.post(database, { scope: input.scope, referenceType: 'benefit.refund', referenceId: `${selected.id}:${input.id}`,
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      currency: selected.currency, description: 'Benefit refund restoration', debit: { code: 'benefit.refund', kind: 'expense' },
      credit: { code: `benefit.${selected.id}`, kind: 'liability' }, amountMinor: input.amountMinor });
  }

  async release(database: OperationDatabase, order: string): Promise<void> {
    await database.query(`update benefit.reservation set state='released' where owner_id=$1 and state='active'`, [order]);
  }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

  private financial(): FinancialPosting {
    if (!this.finance) throw new Error('BENEFIT_FINANCE_DEPENDENCY_REQUIRED');
    return this.finance;
  }
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

interface Source {
  readonly id: string; readonly lot_id: string; readonly amount_minor: number; readonly restored_minor: number; readonly batch_id: string;
  readonly member_id: string; readonly state: string; readonly expires_at: string | null;
}
