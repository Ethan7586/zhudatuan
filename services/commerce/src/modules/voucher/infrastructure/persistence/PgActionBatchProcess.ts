import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { pruneExportSnapshots } from './ExportSnapshot';
import { VOUCHER_TERMS } from './IssueTerms';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { JobPort } from '../../../runtime/public';
import type { ActionBatchWork } from '../../application/process/ActionBatchProcess';
import { Voucher, type VoucherState } from '../../domain/model/Voucher';
import { VoucherTenderWriter } from './VoucherTenderWriter';

interface BatchRow {
  readonly id: string;
  readonly action: 'activate' | 'disable' | 'enable' | 'void' | 'extend';
  readonly reason: string;
  readonly expires_at: Date | null;
  readonly state: 'queued' | 'running' | 'completed' | 'failed';
  readonly requested: number;
}
interface VoucherRow {
  readonly item_state: string;
  readonly id: string;
  readonly credential_id: string;
  readonly product_id: string;
  readonly holder_id: string | null;
  readonly initial_minor: number;
  readonly remaining_minor: number;
  readonly state: VoucherState;
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly version: number;
}
interface Progress { readonly processed: number; readonly succeeded: number; readonly failed: number; readonly retryable: number; }

const CHUNK_SIZE = 250;

export class PgActionBatchProcess implements ActionBatchWork {
  private readonly transactions = new PgTransactionAccess();
  private readonly tenders = new VoucherTenderWriter(this.transactions);
  constructor(private readonly manager: TransactionManager, private readonly jobs: JobPort) {}

  async execute(input: Parameters<ActionBatchWork['execute']>[0]): Promise<void> {
    for (;;) {
      available(input);
      const completed = await this.manager.write(options(input), async (context) => {
        const database = this.transactions.database(context);
        const batch = (await database.query<BatchRow>(`select id,action,reason,expires_at,state,requested::integer from voucher.actionbatch where id=$1 and scope_id=$2 for update`, [input.batch, input.scope])).rows[0];
        if (!batch) throw new Error('VOUCHER_ACTION_BATCH_MISSING');
        if (batch.state === 'completed' || (batch.state === 'failed' && (await progressOf(database, batch.id)).retryable === 0)) return true;
        if (batch.state === 'queued') await database.query(`update voucher.actionbatch set state='running',version=version+1 where id=$1 and scope_id=$2`, [batch.id, input.scope]);
        const rows = await database.query<VoucherRow>(
          `select item.state item_state,voucher.id,voucher.credential_id,voucher.product_id,voucher.holder_id,voucher.initial_minor::integer,
           voucher.remaining_minor::integer,voucher.state,voucher.starts_at,voucher.expires_at,voucher.version::integer
           from voucher.actionitem item join voucher.voucher voucher on voucher.id=item.voucher_id
           where item.batch_id=$1 and item.scope_id=$2 and item.state='queued' order by item.voucher_id limit $3
           for update of item,voucher skip locked`,
          [batch.id, input.scope, CHUNK_SIZE]
        );
        if (rows.rows.length === 0) return settle(database, input, batch);
        for (const row of rows.rows) await applyItem(database, input, batch, row);
        const progress = await progressOf(database, batch.id);
        const terminal = progress.processed === batch.requested;
        await database.query(
          `update voucher.actionbatch set processed=$3,succeeded=$4,failed=$5,retryable=$6,state=case when $7 then case when $5>0 then 'failed' else 'completed' end else 'running' end,version=version+1
           where id=$1 and scope_id=$2`,
          [batch.id, input.scope, progress.processed, progress.succeeded, progress.failed, progress.retryable, terminal]
        );
        await this.jobs.progress(context, input.job, input.scope, 'voucher', { total: batch.requested, ...progress });
        return terminal;
      });
      if (completed) return;
    }
  }

  async maintain(input: Parameters<ActionBatchWork['maintain']>[0]): Promise<void> {
    for (;;) {
      if (input.signal.aborted) throw input.signal.reason ?? new Error('VOUCHER_MAINTENANCE_ABORTED');
      if (Date.now() >= input.deadline) throw new Error('DEADLINE_EXCEEDED');
      const changed = await this.manager.write({ tenant: 'organization-platform-root', membership: '', scope: 'organization-platform-root', actor: 'system:voucher',
        trace: input.job, operation: 'job.voucher.maintenance', workload: 'jobs', signal: input.signal, deadline: input.deadline }, async (context) => {
        const database = this.transactions.database(context);
        const holds = await database.query<{ id: string; voucher_id: string; scope_id: string }>(
          `select hold.id,hold.voucher_id,hold.scope_id from voucher.voucher voucher
           join voucher.tenderhold hold on hold.voucher_id=voucher.id and hold.scope_id=voucher.scope_id
           where hold.state='active' and hold.expires_at<=clock_timestamp()
           order by voucher.id limit 500 for update of voucher skip locked`
        );
        for (const hold of holds.rows) {
          await this.tenders.release({ context, scope: hold.scope_id, hold: hold.id, ifActive: true, expiredOnly: true,
            reason: 'holdexpiry', actor: context.actor, now: new Date() });
        }
        const activations = await database.query<{ id: string; scope_id: string; state: string }>(
          `select voucher.id,voucher.scope_id,voucher.state from voucher.voucher voucher ${VOUCHER_TERMS}
           where terms.activation='automatic' and voucher.state in('allocated','bound')
           and voucher.starts_at<=clock_timestamp() and voucher.expires_at>clock_timestamp()
           order by voucher.starts_at,voucher.id limit 500 for update of voucher skip locked`
        );
        for (const voucher of activations.rows) {
          await database.query(`update voucher.voucher set state='active',version=version+1 where id=$1 and scope_id=$2 and state=$3`, [voucher.id, voucher.scope_id, voucher.state]);
          await database.query(`insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
            select $1,$2,coalesce(max(sequence),0)+1,$3,'active','automatic activation','system:voucher',clock_timestamp() from voucher.timeline where voucher_id=$1`,
          [voucher.id, voucher.scope_id, voucher.state]);
        }
        const vouchers = await database.query<{ id: string; scope_id: string; state: string }>(
          `select id,scope_id,state from voucher.voucher where state in('available','allocated','bound','active','held','disabled') and expires_at<=clock_timestamp()
           order by expires_at,id limit 500 for update skip locked`
        );
        for (const voucher of vouchers.rows) {
          await database.query(`update voucher.tenderhold set state='expired',version=version+1 where voucher_id=$1 and scope_id=$2 and state='active'`, [voucher.id, voucher.scope_id]);
          await database.query(`update voucher.voucher set state='expired',version=version+1 where id=$1 and scope_id=$2 and state=$3`, [voucher.id, voucher.scope_id, voucher.state]);
          await database.query(`insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
            select $1,$2,coalesce(max(sequence),0)+1,$3,'expired','validity','system:voucher',clock_timestamp() from voucher.timeline where voucher_id=$1`,
          [voucher.id, voucher.scope_id, voucher.state]);
        }
        return holds.rows.length + activations.rows.length + vouchers.rows.length + await pruneExportSnapshots(database);
      });
      if (changed < 500) return;
    }
  }
}

async function applyItem(database: SqlExecutor, input: Parameters<ActionBatchWork['execute']>[0], batch: BatchRow, row: VoucherRow): Promise<void> {
  await database.query('savepoint voucheractionitem');
  try {
    const current = new Voucher({ id: row.id, credential: row.credential_id, product: row.product_id, holder: row.holder_id,
      initialMinor: Number(row.initial_minor), remainingMinor: Number(row.remaining_minor), state: row.state,
      startsAt: new Date(row.starts_at), expiresAt: new Date(row.expires_at), version: Number(row.version) });
    const now = new Date();
    const changed = batch.action === 'activate' ? current.activate(now)
      : batch.action === 'disable' ? current.disable()
        : batch.action === 'enable' ? current.enable(now)
          : batch.action === 'void' ? current.void()
            : current.extend(requiredExpiry(batch.expires_at), now);
    if ((batch.action === 'disable' || batch.action === 'void') && row.state === 'held') {
      await database.query(`update voucher.tenderhold set state='released',version=version+1 where voucher_id=$1 and scope_id=$2 and state='active'`, [row.id, input.scope]);
    }
    if (batch.action === 'void' && row.holder_id) {
      await database.query(`update voucher.holder set state='released',released_at=clock_timestamp(),version=version+1 where id=$1 and state='bound'`, [row.holder_id]);
    }
    await database.query(`update voucher.voucher set holder_id=$3,state=$4,expires_at=$5,version=$6 where id=$1 and scope_id=$2 and version=$7`,
      [row.id, input.scope, batch.action === 'void' ? null : changed.value.holder, changed.value.state, changed.value.expiresAt, changed.value.version, row.version]);
    await database.query(
      `insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
       select $1,$2,coalesce(max(sequence),0)+1,$3,$4,$5,'system:voucher',clock_timestamp() from voucher.timeline where voucher_id=$1`,
      [row.id, input.scope, row.state, changed.value.state, batch.reason]
    );
    await database.query(`update voucher.actionitem set state='succeeded',previous_state=$3,next_state=$4,error_code=null,retryable=false,updated_at=clock_timestamp()
      where batch_id=$1 and voucher_id=$2 and state='queued'`, [batch.id, row.id, row.state, changed.value.state]);
    await database.query('release savepoint voucheractionitem');
  } catch (cause) {
    if (!(cause instanceof DomainError)) throw cause;
    await database.query('rollback to savepoint voucheractionitem');
    await database.query(`update voucher.actionitem set state='failed',previous_state=$3,next_state=null,error_code=$4,retryable=$5,updated_at=clock_timestamp()
      where batch_id=$1 and voucher_id=$2 and state='queued'`, [batch.id, row.id, row.state, cause.code, retryable(cause.code)]);
    await database.query('release savepoint voucheractionitem');
  }
}

async function settle(database: SqlExecutor, input: Parameters<ActionBatchWork['execute']>[0], batch: BatchRow): Promise<boolean> {
  const progress = await progressOf(database, batch.id);
  if (progress.processed !== batch.requested) return false;
  await database.query(`update voucher.actionbatch set state=case when $3>0 then 'failed' else 'completed' end,processed=$4,succeeded=$5,failed=$3,retryable=$6,version=version+1
    where id=$1 and scope_id=$2 and state='running'`, [batch.id, input.scope, progress.failed, progress.processed, progress.succeeded, progress.retryable]);
  return true;
}

async function progressOf(database: SqlExecutor, batch: string): Promise<Progress> {
  return (await database.query<Progress>(
    `select count(*) filter(where state<>'queued')::integer processed,count(*) filter(where state='succeeded')::integer succeeded,
      count(*) filter(where state='failed')::integer failed,count(*) filter(where state='failed' and retryable)::integer retryable
     from voucher.actionitem where batch_id=$1`, [batch]
  )).rows[0] ?? { processed: 0, succeeded: 0, failed: 0, retryable: 0 };
}

function options(input: Parameters<ActionBatchWork['execute']>[0]): TransactionOptions {
  return { tenant: input.scope, membership: '', scope: input.scope, actor: 'system:voucher', trace: input.job, operation: 'job.voucher.action', workload: 'jobs', signal: input.signal, deadline: input.deadline };
}
function requiredExpiry(value: Date | null): Date { if (!value) throw new DomainError('VOUCHER_STATE_INVALID'); return new Date(value); }
function retryable(code: string): boolean { return ['VERSION_CONFLICT', 'VOUCHER_HOLD_CONFLICT'].includes(code); }
function available(input: Pick<Parameters<ActionBatchWork['execute']>[0], 'signal' | 'deadline'>): void {
  if (input.signal.aborted) throw input.signal.reason ?? new Error('VOUCHER_ACTION_ABORTED');
  if (Date.now() >= input.deadline) throw new Error('DEADLINE_EXCEEDED');
}
