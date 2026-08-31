import type { PoolClient } from 'pg';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { BenefitAccountingPort } from '../finance/public/index';
import type { BenefitMemberPort } from '../member/public';
import { BenefitLifecycleJobs } from './BenefitLifecycleJobs';
import { digest, enqueue, event, itemCounts, lockBatch, moveReservedToGranted, object, post, releaseReserved, text, type Batch, type GrantItem } from './BenefitJobSupport';

export class BenefitJobProcessor implements JobProcessor {
  private readonly lifecycle: BenefitLifecycleJobs;
  constructor(
    private readonly pool: DatabasePool,
    private readonly finance: BenefitAccountingPort,
    private readonly members: BenefitMemberPort,
    private readonly kind: 'benefitgrant' | 'benefitexpiry' = 'benefitgrant'
  ) {
    this.lifecycle = new BenefitLifecycleJobs(pool, finance);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (this.kind === 'benefitexpiry') return this.lifecycle.expire();
    const payload = object(job.payload);
    const batch = text(payload.batch, 'BENEFIT_BATCH_REQUIRED');
    return payload.kind === 'benefitrevoke' ? this.revoke(batch) : payload.kind === 'benefitgrant' ? this.grant(batch) : Promise.reject(new Error('BENEFIT_JOB_SUBTYPE_INVALID'));
  }

  private async grant(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await lockBatch(client, batchid);
      if (!selected || ['paused', 'cancelled', 'completed', 'revoking', 'revoked', 'failed', 'rejected'].includes(selected.state)) {
        await client.query('commit');
        return;
      }
      if (!['approved', 'running'].includes(selected.state)) throw new Error('BENEFIT_BATCH_NOT_APPROVED');
      await client.query(`update benefit.grantbatch set state='running',updated_at=clock_timestamp() where id=$1`, [batchid]);
      const items = await client.query<GrantItem>(
        `select member_id,amount_minor::float8 amount_minor from benefit.grantitem
        where batch_id=$1 and state='queued' order by member_id for update skip locked limit 500`,
        [batchid]
      );
      for (const item of items.rows) await this.grantItem(client, selected, item);
      const counts = await itemCounts(client, batchid);
      if (counts.queued > 0) await enqueue(client, selected.scope_id, { kind: 'benefitgrant', batch: batchid });
      await client.query(
        `update benefit.grantbatch set state=case when $2>0 then 'running' when $3>0 then 'scheduled' else 'completed' end,
        updated_at=clock_timestamp() where id=$1 and state='running'`,
        [batchid, counts.queued, counts.scheduled]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async grantItem(client: PoolClient, batch: Batch, item: GrantItem): Promise<void> {
    if (!(await this.members.active(client, item.member_id))) {
      await client.query(`update benefit.grantitem set state='skipped',error_code='MEMBER_INACTIVE' where batch_id=$1 and member_id=$2 and state='queued'`, [batch.id, item.member_id]);
      await releaseReserved(client, batch.budget_id, item.amount_minor);
      return;
    }
    const accountid = `benefit:${digest(`${item.member_id}:${batch.scope_id}:${batch.kind}:${batch.currency}`)}`;
    const financeid = await this.finance.account(client, batch.scope_id, `benefit.${accountid}`, batch.currency, 'liability');
    await client.query(
      `insert into benefit.account(id,member_id,scope_id,kind,currency,status,version,finance_account_id)
      values($1,$2,$3,$4,$5,'active',0,$6) on conflict(member_id,scope_id,kind,currency) do nothing`,
      [accountid, item.member_id, batch.scope_id, batch.kind, batch.currency, financeid]
    );
    const account = await client.query<{ id: string }>(`select id from benefit.account where member_id=$1 and scope_id=$2 and kind=$3 and currency=$4 for update`, [item.member_id, batch.scope_id, batch.kind, batch.currency]);
    const resolved = account.rows[0]?.id;
    if (!resolved) throw new Error('BENEFIT_ACCOUNT_CREATE_FAILED');
    const due = new Date(batch.effective_at).getTime() <= Date.now();
    const lotid = `lot:${digest(`${resolved}:${batch.id}`)}`;
    await client.query(
      `insert into benefit.lot(id,account_id,batch_id,member_id,total_minor,remaining_minor,state,effective_at,expires_at,version)
      values($1,$2,$3,$4,$5,$5,$6,$7,$8,0) on conflict(id) do nothing`,
      [lotid, resolved, batch.id, item.member_id, item.amount_minor, due ? 'active' : 'pending', batch.effective_at, batch.expires_at]
    );
    if (!due) {
      await client.query(`update benefit.grantitem set state='scheduled',error_code=null where batch_id=$1 and member_id=$2 and state='queued'`, [batch.id, item.member_id]);
      return;
    }
    await post(
      this.finance,
      client,
      batch.scope_id,
      'benefit.grant',
      `${batch.id}:${item.member_id}`,
      batch.currency,
      'Benefit grant',
      'benefit.expense',
      'expense',
      `benefit.${resolved}`,
      'liability',
      item.amount_minor,
      batch.effective_at
    );
    await client.query(
      `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
      values($1,$2,'grant',$3,'grantbatch',$4,$5) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
      [`movement:${digest(`${lotid}:grant`)}`, lotid, item.amount_minor, batch.id, batch.effective_at]
    );
    const changed = await client.query(`update benefit.grantitem set state='granted',error_code=null where batch_id=$1 and member_id=$2 and state='queued' returning member_id`, [batch.id, item.member_id]);
    if (changed.rows[0]) {
      await moveReservedToGranted(client, batch.budget_id, item.amount_minor);
      await event(
        client,
        'benefit.granted',
        'account',
        resolved,
        batch.scope_id,
        { batch: batch.id, account: resolved, member: item.member_id, amountMinor: item.amount_minor, currency: batch.currency, kind: batch.kind },
        `benefit:grant:${batch.id}:${item.member_id}`
      );
    }
  }

  private async revoke(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const batch = await lockBatch(client, batchid);
      if (!batch || batch.state === 'revoked') {
        await client.query('commit');
        return;
      }
      if (batch.state !== 'revoking') throw new Error('BENEFIT_BATCH_NOT_REVOKING');
      const items = await client.query<GrantItem>(
        `select member_id,amount_minor::float8 amount_minor from benefit.grantitem
        where batch_id=$1 and state='revoking' order by member_id for update skip locked limit 500`,
        [batchid]
      );
      for (const item of items.rows) await this.revokeItem(client, batch, item);
      const remaining = await client.query<{ count: number }>(`select count(*)::integer count from benefit.grantitem where batch_id=$1 and state='revoking'`, [batchid]);
      if (remaining.rows[0]!.count > 0) await enqueue(client, batch.scope_id, { kind: 'benefitrevoke', batch: batchid });
      else {
        await client.query(`update benefit.grantbatch set state='revoked',updated_at=clock_timestamp() where id=$1 and state='revoking'`, [batchid]);
        await event(client, 'benefit.revoked', 'grantbatch', batchid, batch.scope_id, { batch: batchid }, `benefit:revoke:${batchid}`);
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async revokeItem(client: PoolClient, batch: Batch, item: GrantItem): Promise<void> {
    const lot = await client.query<{ id: string; account_id: string; remaining_minor: number; state: string }>(
      `select id,account_id,
      remaining_minor::float8 remaining_minor,state from benefit.lot where batch_id=$1 and member_id=$2 for update`,
      [batch.id, item.member_id]
    );
    const selected = lot.rows[0];
    if (!selected) {
      await releaseReserved(client, batch.budget_id, item.amount_minor);
      await client.query(`update benefit.grantitem set state='revoked',error_code=null where batch_id=$1 and member_id=$2 and state='revoking'`, [batch.id, item.member_id]);
      return;
    }
    if (selected.state === 'pending') {
      await client.query(`update benefit.lot set state='revoked',remaining_minor=0,version=version+1 where id=$1`, [selected.id]);
      await releaseReserved(client, batch.budget_id, item.amount_minor);
    } else if (selected.remaining_minor > 0 && !['expired', 'revoked'].includes(selected.state)) {
      await post(
        this.finance,
        client,
        batch.scope_id,
        'benefit.revoke',
        `${batch.id}:${item.member_id}`,
        batch.currency,
        'Benefit revoke',
        `benefit.${selected.account_id}`,
        'liability',
        'benefit.recovery',
        'income',
        selected.remaining_minor
      );
      await client.query(`update benefit.lot set state='revoked',remaining_minor=0,version=version+1 where id=$1`, [selected.id]);
      await client.query(`update benefit.budget set granted_minor=granted_minor-$2,version=version+1 where id=$1 and granted_minor>=$2`, [batch.budget_id, selected.remaining_minor]);
    }
    if (selected.remaining_minor > 0)
      await client.query(
        `insert into benefit.lotmovement(id,lot_id,kind,amount_minor,reference_type,reference_id,occurred_at)
      values($1,$2,'revoke',$3,'grantbatch',$4,clock_timestamp()) on conflict(lot_id,kind,reference_type,reference_id) do nothing`,
        [`movement:${digest(`${selected.id}:revoke:${batch.id}`)}`, selected.id, selected.remaining_minor, batch.id]
      );
    await client.query(`update benefit.grantitem set state='revoked',error_code=null where batch_id=$1 and member_id=$2 and state='revoking'`, [batch.id, item.member_id]);
  }
}
