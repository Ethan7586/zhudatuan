import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../foundation/persistence/TransactionManager';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { BenefitAccountingPort } from '../../../finance/public/index';
import { digest, event, moveReservedToGranted, post } from './BenefitGrantPersistence';

export class PgBenefitLifecycleProcess {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly manager: TransactionManager,
    private readonly finance: BenefitAccountingPort
  ) {}
  expire(signal: AbortSignal, deadline: number): Promise<void> {
    return this.manager.write({ tenant: '', membership: '', scope: 'benefit', actor: 'job:benefit', trace: 'benefit:expiry', operation: 'job.benefit.expiry', workload: 'jobs', signal, deadline }, async (context) => {
      const client = this.transactions.database(context);
      await this.activateDue(context, client);
      await this.remindUpcoming(client);
      const lots = await client.query<{
        id: string;
        account_id: string;
        batch_id: string;
        member_id: string;
        remaining_minor: number;
        scope_id: string;
        currency: string;
        budget_id: string;
      }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
        lot.remaining_minor::float8 remaining_minor,account.scope_id,account.currency,batch.budget_id from benefit.lot lot
        join benefit.account account on account.id=lot.account_id join benefit.grantbatch batch on batch.id=lot.batch_id
        where lot.state='active' and lot.expires_at<=clock_timestamp() and lot.remaining_minor>0
          and not exists(select 1 from benefit.reservation reservation where reservation.account_id=lot.account_id
            and reservation.state='active' and reservation.expires_at>clock_timestamp())
        order by lot.expires_at,lot.id for update of lot,account skip locked limit 500`);
      for (const lot of lots.rows) {
        await post(this.finance, context, lot.scope_id, 'benefit.expire', lot.id, lot.currency, 'Benefit expiry', `benefit.${lot.account_id}`, 'liability', 'benefit.expiry', 'income', lot.remaining_minor);
        await client.query(`update benefit.lot set state='expired',remaining_minor=0,version=version+1 where id=$1`, [lot.id]);
        await client.query(
          `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
          values($1,$2,'expire',$3,'lot',$2,clock_timestamp()) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
          [`movement:${digest(`${lot.id}:expire`)}`, lot.id, lot.remaining_minor]
        );
        await client.query(`update benefit.budget set granted_minor=granted_minor-$2,version=version+1 where id=$1 and granted_minor>=$2`, [lot.budget_id, lot.remaining_minor]);
        await client.query(`update benefit.grantitem set state='expired' where batch_id=$1 and member_id=$2 and state='granted'`, [lot.batch_id, lot.member_id]);
        await event(
          client,
          'benefit.expired',
          'lot',
          lot.id,
          lot.scope_id,
          { lot: lot.id, batch: lot.batch_id, account: lot.account_id, member: lot.member_id, amountMinor: lot.remaining_minor, currency: lot.currency },
          `benefit:expire:${lot.id}`
        );
      }
    });
  }

  private async activateDue(context: WriteTransactionContext, client: SqlExecutor): Promise<void> {
    const lots = await client.query<{
      id: string;
      account_id: string;
      batch_id: string;
      member_id: string;
      total_minor: number;
      effective_at: string;
      scope_id: string;
      currency: string;
      kind: string;
      budget_id: string;
    }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
      lot.total_minor::float8 total_minor,lot.effective_at,account.scope_id,account.currency,account.kind,batch.budget_id from benefit.lot lot
      join benefit.account account on account.id=lot.account_id join benefit.grantbatch batch on batch.id=lot.batch_id
      where lot.state='pending' and lot.effective_at<=clock_timestamp() and batch.state='scheduled'
      order by lot.effective_at,lot.id for update of lot skip locked limit 500`);
    for (const lot of lots.rows) {
      await post(
        this.finance,
        context,
        lot.scope_id,
        'benefit.grant',
        `${lot.batch_id}:${lot.member_id}`,
        lot.currency,
        'Scheduled benefit grant',
        'benefit.expense',
        'expense',
        `benefit.${lot.account_id}`,
        'liability',
        lot.total_minor,
        lot.effective_at
      );
      await client.query(`update benefit.lot set state='active',version=version+1 where id=$1 and state='pending'`, [lot.id]);
      await client.query(
        `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
        values($1,$2,'grant',$3,'grantbatch',$4,$5) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
        [`movement:${digest(`${lot.id}:grant`)}`, lot.id, lot.total_minor, lot.batch_id, lot.effective_at]
      );
      await client.query(`update benefit.grantitem set state='granted',error_code=null where batch_id=$1 and member_id=$2 and state='scheduled'`, [lot.batch_id, lot.member_id]);
      await moveReservedToGranted(client, lot.budget_id, lot.total_minor);
      await event(
        client,
        'benefit.granted',
        'account',
        lot.account_id,
        lot.scope_id,
        { batch: lot.batch_id, account: lot.account_id, member: lot.member_id, amountMinor: lot.total_minor, currency: lot.currency, kind: lot.kind },
        `benefit:grant:${lot.batch_id}:${lot.member_id}`
      );
      await client.query(
        `update benefit.grantbatch set state='completed',updated_at=clock_timestamp() where id=$1 and state='scheduled'
        and not exists(select 1 from benefit.grantitem where batch_id=$1 and state='scheduled')`,
        [lot.batch_id]
      );
    }
  }

  private async remindUpcoming(client: SqlExecutor): Promise<void> {
    const lots = await client.query<{
      id: string;
      account_id: string;
      batch_id: string;
      member_id: string;
      remaining_minor: number;
      expires_at: string;
      scope_id: string;
      currency: string;
    }>(`select lot.id,lot.account_id,lot.batch_id,lot.member_id,
      lot.remaining_minor::float8 remaining_minor,lot.expires_at,account.scope_id,account.currency from benefit.lot lot
      join benefit.account account on account.id=lot.account_id where lot.state='active' and lot.remaining_minor>0
      and lot.expires_at>clock_timestamp() and lot.expires_at<=clock_timestamp()+interval '3 days'
      and not exists(select 1 from benefit.reminder reminder where reminder.lot_id=lot.id and reminder.kind='expiry')
      order by lot.expires_at,lot.id for update of lot skip locked limit 500`);
    for (const lot of lots.rows) {
      const inserted = await client.query(
        `insert into benefit.reminder(id,lot_id,kind,scheduled_at,sent_at)
        values($1,$2,'expiry',clock_timestamp(),clock_timestamp()) on conflict(lot_id,kind) do nothing returning id`,
        [`reminder:${digest(`${lot.id}:expiry`)}`, lot.id]
      );
      if (inserted.rows[0])
        await event(
          client,
          'benefit.expiry.reminded',
          'lot',
          lot.id,
          lot.scope_id,
          { lot: lot.id, batch: lot.batch_id, account: lot.account_id, member: lot.member_id, remainingMinor: lot.remaining_minor, currency: lot.currency, expiresAt: lot.expires_at },
          `benefit:expiry:reminder:${lot.id}`
        );
    }
  }
}
