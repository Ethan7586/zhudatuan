import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { JobPort } from '../../../runtime/public';
import type { IssueBatchWork } from '../../application/process/IssueBatchProcess';
import { ISSUE_BATCH_FIELDS } from './VoucherSupport';
import { CHUNK_SIZE, available, decideStock, digest, integer, issueOrder, issueVouchers, options, progressOf, settle, text, type BatchRow, type CredentialRow, type ItemRow } from './IssueBatchStore';

export class PgIssueBatchProcess implements IssueBatchWork {
  private readonly transactions = new PgTransactionAccess();

  constructor(
    private readonly manager: TransactionManager,
    private readonly jobs: JobPort,
    private readonly finance: VoucherAccountingPort
  ) {}

  async issue(input: Parameters<IssueBatchWork['issue']>[0]): Promise<void> {
    for (;;) {
      available(input);
      const complete = await this.manager.write(options(input.scope, input.job, 'issue', input.signal, input.deadline), async (context) => {
        const database = this.transactions.database(context);
        const batch = (await database.query<BatchRow>(`select ${ISSUE_BATCH_FIELDS} from voucher.issuebatch batch where batch.id=$1 and batch.scope_id=$2 for update`, [input.batch, input.scope])).rows[0];
        if (!batch || batch.state === 'cancelled') throw new Error('VOUCHER_ISSUE_BATCH_INVALID');
        if (batch.state === 'completed' || (batch.state === 'failed' && batch.retryable === 0)) return true;
        const issue = await issueOrder(database, batch.order_id, input.scope);
        if (batch.state === 'queued') {
          await database.query(`update voucher.issuebatch set state='running',version=version+1 where id=$1 and scope_id=$2`, [batch.id, input.scope]);
          await database.query(`update voucher.issueorder set state='issuing',version=version+1 where id=$1 and scope_id=$2 and state in('approved','failed')`, [issue.id, input.scope]);
        }
        const items = await database.query<ItemRow>(`select ordinal::integer from voucher.issueitem where batch_id=$1 and scope_id=$2 and state='queued' order by ordinal limit $3 for update skip locked`, [
          batch.id,
          input.scope,
          CHUNK_SIZE,
        ]);
        if (items.rows.length === 0) return settle(database, context, input, issue, this.finance);
        const pool = (await database.query<{ state: string }>(`select state from voucher.credentialpool where id=$1 and scope_id=$2 for share`, [issue.pool_id, input.scope])).rows[0];
        if (!pool) throw new Error('VOUCHER_ISSUE_POOL_MISSING');
        const expired = new Date(issue.expires_at).getTime() <= Date.now();
        const credentials =
          pool.state === 'open' && !expired
            ? await database.query<CredentialRow>(
                `select id,number_fingerprint,number_masked,key_version,version::integer from voucher.credential
           where scope_id=$1 and pool_id=$2 and product_id=$3 and state='available'
           order by id limit $4 for update skip locked`,
                [input.scope, issue.pool_id, issue.product_id, items.rows.length]
              )
            : { rows: [] };
        const succeeded = items.rows.slice(0, credentials.rows.length).map((item, index) => ({ item, credential: credentials.rows[index]! }));
        const failed = items.rows.slice(credentials.rows.length);
        if (succeeded.length > 0) await issueVouchers(database, input, issue, succeeded);
        if (failed.length > 0)
          await database.query(
            `update voucher.issueitem set state='failed',error_code=$3,retryable=$4,updated_at=clock_timestamp()
           where batch_id=$1 and ordinal=any($2::bigint[]) and state='queued'`,
            [batch.id, failed.map(({ ordinal }) => ordinal), expired ? 'VOUCHER_STATE_INVALID' : pool.state === 'open' ? 'VOUCHER_STOCK_INSUFFICIENT' : 'VOUCHER_POOL_CLOSED', pool.state === 'open' && !expired]
          );
        const progress = await progressOf(database, batch.id);
        const terminal = progress.processed === batch.requested;
        await database.query(
          `update voucher.issuebatch set processed=$3,succeeded=$4,failed=$5,retryable=$6,state=case when $7 then case when $5::bigint>0 then 'failed' else 'completed' end else 'running' end,version=version+1
           where id=$1 and scope_id=$2`,
          [batch.id, input.scope, progress.processed, progress.succeeded, progress.failed, progress.retryable, terminal]
        );
        await this.jobs.progress(context, input.job, input.scope, 'voucher', { total: batch.requested, ...progress });
        if (terminal) await settle(database, context, input, issue, this.finance);
        return terminal;
      });
      if (complete) return;
    }
  }

  approval(input: Parameters<IssueBatchWork['approval']>[0]): Promise<void> {
    return this.manager.write(options(input.scope, input.event, 'approval', input.signal, input.deadline), async (context) => {
      const database = this.transactions.database(context);
      const runtime = new PgRuntimeWriter(database);
      const inbox = await runtime.claim('job:voucherissue', input.event);
      if (!inbox) throw new Error('VOUCHER_APPROVAL_CONTEXT_MISSING');
      if (inbox.type !== input.type || inbox.version !== 1 || inbox.scope !== input.scope) throw new Error('VOUCHER_APPROVAL_CONTEXT_MISMATCH');
      const payload = inbox.payload;
      const subject = text(payload.subjectId, 'VOUCHER_APPROVAL_SUBJECT_REQUIRED');
      const kind = payload.subjectKind;
      const instance = text(payload.instanceId, 'VOUCHER_APPROVAL_INSTANCE_REQUIRED');
      const subjectVersion = integer(payload.subjectVersion, 'VOUCHER_APPROVAL_VERSION_INVALID');
      const approved = input.type === 'approval.instance.approved';
      if (kind === 'voucherstock') await decideStock(database, input.scope, subject, instance, subjectVersion, approved);
      if (kind === 'voucherissue') await this.decideIssue(context, database, input.scope, subject, instance, subjectVersion, approved);
      if (!(await runtime.completeInbox('job:voucherissue', input.event))) throw new Error('VOUCHER_APPROVAL_INBOX_CONFLICT');
    });
  }

  private async decideIssue(context: Parameters<JobPort['create']>[0], database: SqlExecutor, scope: string, id: string, instance: string, version: number, approved: boolean): Promise<void> {
    const current = await database.query<{ quantity: number; state: string; version: number; approval_instance_id: string }>(
      `select quantity::integer,state,version::integer,approval_instance_id from voucher.issueorder where id=$1 and scope_id=$2 for update`,
      [id, scope]
    );
    const row = current.rows[0];
    if (!row) throw new Error('VOUCHER_ISSUE_ORDER_MISSING');
    if (row.state !== 'submitted') return;
    if (row.approval_instance_id !== instance || row.version !== version + 1) throw new Error('VOUCHER_APPROVAL_EVIDENCE_MISMATCH');
    if (!approved) {
      await database.query(`update voucher.issueorder set state='cancelled',version=version+1 where id=$1 and scope_id=$2`, [id, scope]);
      return;
    }
    const batch = `issuebatch:${digest(`${scope}\u0000${id}`).slice(0, 32)}`;
    await database.query(`update voucher.issueorder set state='approved',version=version+1 where id=$1 and scope_id=$2`, [id, scope]);
    await database.query(
      `insert into voucher.issuebatch(id,order_id,scope_id,state,requested,processed,succeeded,failed,retryable,version,created_at,updated_at)
       values($1,$2,$3,'queued',$4,0,0,0,0,1,clock_timestamp(),clock_timestamp()) on conflict(order_id) do nothing`,
      [batch, id, scope, row.quantity]
    );
    await database.query(
      `insert into voucher.issueitem(batch_id,scope_id,ordinal,credential_id,state,error_code,retryable,idempotency_key,updated_at)
       select $1,$2,ordinal,null,'queued',null,false,$1||':'||ordinal,clock_timestamp() from generate_series(1,$3) ordinal
       on conflict(batch_id,ordinal) do nothing`,
      [batch, scope, row.quantity]
    );
    await this.jobs.create(context, { scope, owner: 'voucher', kind: 'voucherissue', queue: 'batch', payload: { batch }, idempotency: `approval:${instance}`, actor: 'system:voucher' });
  }
}
