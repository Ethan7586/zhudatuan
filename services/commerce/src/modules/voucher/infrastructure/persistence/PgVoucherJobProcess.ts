import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { VoucherPolicy, voucherState } from '../../domain/policy/VoucherPolicy';
import type { VoucherAccountingPort } from '../../../finance/public/index';
import { PgVoucherIssueProcess } from './PgVoucherIssueProcess';
import { enqueue, errorCode } from './VoucherQueuePersistence';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { VoucherJobExecution, VoucherJobProcess } from '../../application/port/VoucherJobProcess';

export class PgVoucherJobProcess implements VoucherJobProcess {
  private readonly policy = new VoucherPolicy();
  private readonly issueJobs: PgVoucherIssueProcess;
  constructor(
    private readonly manager: TransactionManager,
    private readonly kms: KmsClient,
    private readonly finance: VoucherAccountingPort,
    private readonly transactions = new PgTransactionAccess()
  ) {
    this.issueJobs = new PgVoucherIssueProcess(manager, kms, finance);
  }

  issue(batch: string, execution: VoucherJobExecution): Promise<void> {
    return this.issueJobs.issue(batch, execution.scope, execution.signal, execution.deadline);
  }

  async expire(execution: VoucherJobExecution): Promise<void> {
    const options = transactionOptions(execution, 'voucherexpiry');
    await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      const expired = await database.query<{ id: string; state: string }>(`select id,state from voucher.voucher where expires_at<=clock_timestamp()
        and state in('inactive','active','held','disabled') order by expires_at,id for update skip locked limit 1000`);
      for (const voucher of expired.rows) {
        await database.query(`update voucher.reserve set state='released',version=version+1 where voucher_id=$1 and state in('requested','approved')`, [voucher.id]);
        await database.query(`update voucher.voucher set state='expired',version=version+1 where id=$1`, [voucher.id]);
        await database.query(
          `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
          select $1,coalesce(max(sequence),0)+1,$2,'expired','expiryjob','system',clock_timestamp() from voucher.statusevent where voucher_id=$1`,
          [voucher.id, voucher.state]
        );
      }
    });
  }

  async status(batchid: string, execution: VoucherJobExecution): Promise<void> {
    const options = transactionOptions(execution, 'voucherstatus');
    const selected = await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      const batchResult = await database.query<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>(
        `update voucher.statusbatch set state='running',updated_at=clock_timestamp() where id=$1 and state in('queued','running')
        returning scope_id,action,expires_at,reason,actor_id`,
        [batchid]
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new Error('VOUCHER_STATUS_BATCH_NOT_RUNNABLE');
      const items = await database.query<{ voucher_id: string }>(
        `select voucher_id from voucher.statusitem where batch_id=$1 and state='queued'
        order by voucher_id for update skip locked limit 500`,
        [batchid]
      );
      return Object.freeze({ batch: Object.freeze(batch), items: Object.freeze(items.rows.map(({ voucher_id }) => voucher_id)) });
    });
    for (const voucher of selected.items) {
      try {
        await this.manager.write(options, (context) => this.change(this.transactions.database(context), batchid, voucher, selected.batch));
      } catch (cause) {
        await this.manager.write(options, (context) =>
          this.transactions
            .database(context)
            .query(
              `update voucher.statusitem set state='failed',error_code=$3,updated_at=clock_timestamp()
          where batch_id=$1 and voucher_id=$2`,
              [batchid, voucher, errorCode(cause)]
            )
            .then(() => undefined)
        );
      }
    }
    await this.manager.write(options, async (context) => {
      const database = this.transactions.database(context);
      const totals = await database.query<{ queued: number; succeeded: number; failed: number }>(
        `select count(*) filter(where state='queued')::integer queued,
        count(*) filter(where state='succeeded')::integer succeeded,count(*) filter(where state='failed')::integer failed
        from voucher.statusitem where batch_id=$1`,
        [batchid]
      );
      const counts = totals.rows[0]!;
      await database.query(
        `update voucher.statusbatch set state=case when $2=0 then 'completed' else 'running' end,
        succeeded_count=$3,failed_count=$4,updated_at=clock_timestamp() where id=$1`,
        [batchid, counts.queued, counts.succeeded, counts.failed]
      );
      if (counts.queued > 0) await enqueue(database, 'voucherstatus', selected.batch.scope_id, { batch: batchid });
    });
  }

  private async change(database: SqlExecutor, batchid: string, voucherid: string, batch: Readonly<{ scope_id: string; action: string; expires_at: string | null; reason: string; actor_id: string }>): Promise<void> {
    const selected = await database.query<{ state: string; member_id: string | null; remaining_minor: number; expires_at: string }>(
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
      await database.query(
        `insert into voucher.hold(id,voucher_id,amount_minor,state,reason,evidence,created_at)
        values($1,$2,$3,'open',$4,jsonb_build_object('actor',$5,'batch',$6),clock_timestamp()) on conflict(voucher_id) do nothing`,
        [`hold:${voucherid}`, voucherid, voucher.remaining_minor, batch.reason, batch.actor_id, batchid]
      );
    await database.query(
      `update voucher.voucher set state=$2,expires_at=case when $3='extend' then $4::timestamptz else expires_at end,
        version=version+1 where id=$1`,
      [voucherid, next, batch.action, batch.expires_at]
    );
    await database.query(
      `insert into voucher.statusevent(voucher_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
        select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,clock_timestamp() from voucher.statusevent where voucher_id=$1`,
      [voucherid, voucher.state, next, batch.reason, batch.actor_id]
    );
    await database.query(
      `update voucher.statusitem set state='succeeded',previous_state=$3,next_state=$4,error_code=null,updated_at=clock_timestamp()
        where batch_id=$1 and voucher_id=$2`,
      [batchid, voucherid, voucher.state, next]
    );
  }
}

function transactionOptions(execution: VoucherJobExecution, kind: string): TransactionOptions {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: `job:${kind}`,
    trace: execution.trace,
    operation: `job.voucher.${kind}`,
    workload: 'jobs',
    signal: execution.signal,
    deadline: execution.deadline,
  };
}
