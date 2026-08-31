import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { KmsClient } from '../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { VoucherPolicy, voucherState } from './domain/policy/VoucherPolicy';
import type { VoucherAccountingPort } from '../finance/public/index';
import { VoucherIssueJobs } from './VoucherIssueJobs';
import { enqueue, errorCode, identifier } from './VoucherJobSupport';

export class VoucherJobProcessor implements JobProcessor {
  private readonly policy = new VoucherPolicy();
  private readonly issueJobs: VoucherIssueJobs;
  constructor(
    private readonly pool: DatabasePool,
    private readonly kms: KmsClient,
    private readonly finance: VoucherAccountingPort,
    private readonly kind: 'voucherissue' | 'voucherexpiry' | 'voucherstatus'
  ) {
    this.issueJobs = new VoucherIssueJobs(pool, kms, finance);
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    if (this.kind === 'voucherexpiry') return this.expire();
    const batch = identifier(job.payload, 'batch', 'VOUCHER_BATCH_REQUIRED');
    return this.kind === 'voucherstatus' ? this.status(batch) : this.issueJobs.issue(batch);
  }

  private async expire(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const expired = await client.query<{ id: string; state: string }>(`select id,state from voucher.voucher where expires_at<=clock_timestamp()
        and state in('inactive','active','held','disabled') order by expires_at,id for update skip locked limit 1000`);
      for (const voucher of expired.rows) {
        await client.query(`update voucher.reserve set state='released',version=version+1 where voucher_id=$1 and state in('requested','approved')`, [voucher.id]);
        await client.query(`update voucher.voucher set state='expired',version=version+1 where id=$1`, [voucher.id]);
        await client.query(
          `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
          select $1,coalesce(max(sequence),0)+1,$2,'expired','expiryjob','system',clock_timestamp() from voucher.statusevent where voucher_id=$1`,
          [voucher.id, voucher.state]
        );
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async status(batchid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const selected = await client.query<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>(
        `update voucher.statusbatch set state='running',updated_at=clock_timestamp() where id=$1 and state in('queued','running')
        returning scope_id,action,expires_at,reason,actor_id`,
        [batchid]
      );
      const batch = selected.rows[0];
      if (!batch) throw new Error('VOUCHER_STATUS_BATCH_NOT_RUNNABLE');
      const items = await client.query<{ voucher_id: string }>(
        `select voucher_id from voucher.statusitem where batch_id=$1 and state='queued'
        order by voucher_id for update skip locked limit 500`,
        [batchid]
      );
      for (const row of items.rows) await this.change(client, batchid, row.voucher_id, batch);
      const totals = await client.query<{ queued: number; succeeded: number; failed: number }>(
        `select count(*) filter(where state='queued')::integer queued,
        count(*) filter(where state='succeeded')::integer succeeded,count(*) filter(where state='failed')::integer failed
        from voucher.statusitem where batch_id=$1`,
        [batchid]
      );
      const counts = totals.rows[0]!;
      await client.query(
        `update voucher.statusbatch set state=case when $2=0 then 'completed' else 'running' end,
        succeeded_count=$3,failed_count=$4,updated_at=clock_timestamp() where id=$1`,
        [batchid, counts.queued, counts.succeeded, counts.failed]
      );
      if (counts.queued > 0) await enqueue(client, 'voucherstatus', batch.scope_id, { batch: batchid });
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }

  private async change(client: import('pg').PoolClient, batchid: string, voucherid: string, batch: Readonly<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>): Promise<void> {
    await client.query('savepoint voucherstatusitem');
    try {
      const selected = await client.query<{ state: string; member_id: string | null; remaining_minor: number; expires_at: string }>(
        `select voucher.state,
        voucher.member_id,voucher.remaining_minor::float8 remaining_minor,voucher.expires_at from voucher.voucher voucher
        join voucher.program program on program.id=voucher.program_id where voucher.id=$1 and program.scope_id=$2 for update`,
        [voucherid, batch.scope_id]
      );
      const voucher = selected.rows[0];
      if (!voucher) throw new Error('VOUCHER_NOT_FOUND');
      const next = batch.action === 'activate' ? 'active' : batch.action === 'disable' ? 'disabled' : batch.action === 'void' ? 'void' : voucher.state;
      if (batch.action === 'extend') {
        if (!['inactive', 'active', 'disabled'].includes(voucher.state)) throw new Error('VOUCHER_EXTENSION_STATE_INVALID');
        if (batch.expires_at === null || new Date(batch.expires_at).getTime() <= new Date(voucher.expires_at).getTime()) throw new Error('VOUCHER_EXTENSION_NOT_LATER');
      } else this.policy.assertTransition(voucherState(voucher.state), voucherState(next));
      if (batch.action === 'void' && voucher.remaining_minor > 0)
        await client.query(
          `insert into voucher.hold(id,voucher_id,amount_minor,state,reason,evidence,created_at)
        values($1,$2,$3,'open',$4,jsonb_build_object('actor',$5,'batch',$6),clock_timestamp()) on conflict(voucher_id) do nothing`,
          [`hold:${voucherid}`, voucherid, voucher.remaining_minor, batch.reason, batch.actor_id, batchid]
        );
      await client.query(
        `update voucher.voucher set state=$2,expires_at=case when $3='extend' then $4::timestamptz else expires_at end,
        version=version+1 where id=$1`,
        [voucherid, next, batch.action, batch.expires_at]
      );
      await client.query(
        `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from voucher.statusevent where voucher_id=$1`,
        [voucherid, voucher.state, next, batch.reason, batch.actor_id]
      );
      await client.query(
        `update voucher.statusitem set state='succeeded',previous_state=$3,next_state=$4,error_code=null,updated_at=clock_timestamp()
        where batch_id=$1 and voucher_id=$2`,
        [batchid, voucherid, voucher.state, next]
      );
      await client.query('release savepoint voucherstatusitem');
    } catch (cause) {
      await client.query('rollback to savepoint voucherstatusitem');
      await client.query('release savepoint voucherstatusitem');
      await client.query(
        `update voucher.statusitem set state='failed',error_code=$3,updated_at=clock_timestamp()
        where batch_id=$1 and voucher_id=$2`,
        [batchid, voucherid, errorCode(cause)]
      );
    }
  }
}
