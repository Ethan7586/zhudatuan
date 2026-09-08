import { createHash } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { JobPort } from '../../../runtime/public';
import type { IssueBatchWork } from '../../application/process/IssueBatchProcess';
import { Credential } from '../../domain/model/Credential';
import { PgTransactionalOutbox } from '../../../../platform/database/PgTransactionalOutbox';
import { voucherIssued } from '../../domain/event/VoucherEvents';
import { DomainError } from '../../../../platform/error/DomainError';

export interface BatchRow {
  readonly id: string;
  readonly order_id: string;
  readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly requested: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryable: number;
  readonly version: number;
}

export interface IssueRow {
  readonly id: string;
  readonly customer_id: string;
  readonly product_id: string;
  readonly stock_request_id: string;
  readonly quantity: number;
  readonly delivery: 'account' | 'claim';
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly recipient_snapshot: string;
  readonly state: string;
  readonly version: number;
  readonly activation: 'automatic' | 'secret' | 'numbersecret';
  readonly face_minor: number;
  readonly currency: string;
  readonly pool_id: string;
}

export interface ItemRow {
  readonly ordinal: number;
}
export interface CredentialRow {
  readonly id: string;
  readonly number_fingerprint: string;
  readonly number_masked: string;
  readonly key_version: string;
  readonly version: number;
}
export interface ProgressRow {
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryable: number;
}

export const CHUNK_SIZE = 250;

export async function decideStock(database: SqlExecutor, scope: string, id: string, instance: string, version: number, approved: boolean): Promise<void> {
  const changed = await database.query(
    `update voucher.stockrequest set state=case when $5 then 'approved' else 'rejected' end,version=version+1
     where id=$1 and scope_id=$2 and approval_instance_id=$3 and version=$4+1 and state='submitted'`,
    [id, scope, instance, version, approved]
  );
  if (changed.rowCount === 0) {
    const current = await database.query<{ state: string }>(`select state from voucher.stockrequest where id=$1 and scope_id=$2`, [id, scope]);
    if (!current.rows[0] || current.rows[0].state === 'submitted') throw new Error('VOUCHER_APPROVAL_EVIDENCE_MISMATCH');
  }
}

export async function issueOrder(database: SqlExecutor, id: string, scope: string): Promise<IssueRow> {
  const found = await database.query<IssueRow>(
    `select issue.id,issue.customer_id,issue.product_id,issue.stock_request_id,issue.quantity::integer,issue.delivery,issue.starts_at,issue.expires_at,
      issue.recipient_snapshot,issue.state,issue.version::integer,terms.activation,terms.face_minor::integer,terms.currency,terms.pool_id
     from voucher.issueorder issue join voucher.issueterms terms on terms.order_id=issue.id and terms.scope_id=issue.scope_id and terms.product_id=issue.product_id
     where issue.id=$1 and issue.scope_id=$2 for update of issue`,
    [id, scope]
  );
  const row = found.rows[0];
  if (!row || !['approved', 'issuing', 'completed', 'failed'].includes(row.state)) throw new Error('VOUCHER_ISSUE_ORDER_INVALID');
  return row;
}

export async function issueVouchers(database: SqlExecutor, input: Parameters<IssueBatchWork['issue']>[0], issue: IssueRow, rows: readonly Readonly<{ item: ItemRow; credential: CredentialRow }>[]): Promise<void> {
  const issuedAt = (await database.query<{ value: Date }>(`select clock_timestamp() value`)).rows[0]?.value ?? new Date();
  const finalState = issue.activation === 'automatic' && issue.starts_at <= issuedAt ? 'active' : issue.delivery === 'account' ? 'bound' : 'allocated';
  const values = rows.map(({ item, credential }) => {
    const allocated = new Credential({
      id: credential.id,
      pool: issue.pool_id,
      product: issue.product_id,
      fingerprint: credential.number_fingerprint,
      keyVersion: credential.key_version,
      state: 'available',
      issueBatch: null,
      version: credential.version,
    }).allocate(input.batch);
    return {
      ordinal: item.ordinal,
      credential: credential.id,
      voucher: `voucher:${digest(`${input.batch}\u0000${item.ordinal}`).slice(0, 32)}`,
      holder: issue.delivery === 'account' ? `holder:${digest(`${input.batch}\u0000${item.ordinal}`).slice(0, 32)}` : null,
      fingerprint: credential.number_fingerprint,
      masked: credential.number_masked,
      state: allocated.value.state,
      version: allocated.value.version,
    };
  });
  const allocated = await database.query(
    `update voucher.credential credential set state=item.state,issue_batch_id=$1,version=item.version
     from jsonb_to_recordset($2::jsonb) item(credential text,state text,version bigint)
     where credential.id=item.credential and credential.state='available' and credential.version=item.version-1 returning credential.id`,
    [input.batch, JSON.stringify(values)]
  );
  if (allocated.rowCount !== values.length) throw new DomainError('VOUCHER_CREDENTIAL_CONFLICT');
  await database.query(
    `insert into voucher.voucher(id,scope_id,product_id,credential_id,holder_id,number_fingerprint,number_masked,initial_minor,remaining_minor,currency,state,starts_at,expires_at,version,created_at,updated_at)
     select item.voucher,$1,$2,item.credential,null,item.fingerprint,item.masked,$3,$3,$7,'allocated',$4,$5,1,clock_timestamp(),clock_timestamp()
     from jsonb_to_recordset($6::jsonb) item(voucher text,credential text,fingerprint text,masked text) on conflict(credential_id) do nothing`,
    [input.scope, issue.product_id, issue.face_minor, issue.starts_at, issue.expires_at, JSON.stringify(values), issue.currency]
  );
  if (issue.delivery === 'account')
    await database.query(
      `insert into voucher.holder(id,scope_id,voucher_id,member_id,state,version,bound_at,released_at)
     select item.holder,$1,item.voucher,$2,'bound',1,clock_timestamp(),null
     from jsonb_to_recordset($3::jsonb) item(holder text,voucher text) on conflict(id) do nothing`,
      [input.scope, issue.recipient_snapshot, JSON.stringify(values)]
    );
  if (finalState !== 'allocated')
    await database.query(
      `update voucher.voucher voucher set holder_id=item.holder,state=$2,version=version+1
     from jsonb_to_recordset($3::jsonb) item(voucher text,holder text) where voucher.id=item.voucher and voucher.scope_id=$1 and voucher.state='allocated'`,
      [input.scope, finalState, JSON.stringify(values)]
    );
  await database.query(
    `insert into voucher.timeline(voucher_id,scope_id,sequence,previous_state,next_state,reason,actor_id,occurred_at)
     select item.voucher,$1,1,null,$2,'issue','system:voucher',clock_timestamp()
     from jsonb_to_recordset($3::jsonb) item(voucher text) on conflict(voucher_id,sequence) do nothing`,
    [input.scope, finalState, JSON.stringify(values)]
  );
  await database.query(
    `update voucher.issueitem target set credential_id=item.credential,state='succeeded',error_code=null,retryable=false,updated_at=clock_timestamp()
     from jsonb_to_recordset($2::jsonb) item(ordinal bigint,credential text) where target.batch_id=$1 and target.ordinal=item.ordinal and target.state='queued'`,
    [input.batch, JSON.stringify(values)]
  );
}

export async function progressOf(database: SqlExecutor, batch: string): Promise<ProgressRow> {
  const row = (
    await database.query<ProgressRow>(
      `select count(*) filter(where state<>'queued')::integer processed,count(*) filter(where state='succeeded')::integer succeeded,
      count(*) filter(where state='failed')::integer failed,count(*) filter(where state='failed' and retryable)::integer retryable
     from voucher.issueitem where batch_id=$1`,
      [batch]
    )
  ).rows[0];
  return row ?? { processed: 0, succeeded: 0, failed: 0, retryable: 0 };
}

export async function settle(database: SqlExecutor, context: Parameters<JobPort['progress']>[0], input: Parameters<IssueBatchWork['issue']>[0], issue: IssueRow, finance: VoucherAccountingPort): Promise<boolean> {
  const progress = await progressOf(database, input.batch);
  if (progress.processed !== issue.quantity) return false;
  const state = progress.failed > 0 ? 'failed' : 'completed';
  await database.query(`update voucher.issueorder set state=$3,version=version+1 where id=$1 and scope_id=$2 and state='issuing'`, [issue.id, input.scope, state]);
  if (state === 'completed')
    await database.query(
      `update voucher.stockrequest request set state='fulfilled',version=version+1 where request.id=$1 and request.scope_id=$2 and request.state='approved'
     and not exists(select 1 from voucher.issueorder target where target.stock_request_id=request.id and target.state not in('completed','cancelled','failed'))
     and (select coalesce(sum(target.quantity),0) from voucher.issueorder target where target.stock_request_id=request.id and target.state='completed')>=request.quantity`,
      [issue.stock_request_id, input.scope]
    );
  const accounted = (await database.query<{ accounted: number; version: number }>(`select accounted::integer,version::integer from voucher.issuebatch where id=$1 and scope_id=$2 for update`, [input.batch, input.scope])).rows[0];
  if (!accounted || accounted.accounted > progress.succeeded) throw new Error('VOUCHER_BATCH_PROGRESS_INVALID');
  const count = progress.succeeded - accounted.accounted;
  const receipt = `${input.batch}:${progress.succeeded}`;
  const issuedEvent = eventId(`issued:${receipt}`);
  if (count > 0)
    await finance.post(context, {
      scopeId: input.scope,
      source: { module: 'voucher', aggregate: 'issueorder', aggregateId: issue.id, event: 'voucher.issue', eventId: issuedEvent, leg: 'issue' },
      currency: issue.currency,
      description: '卡券发放',
      debit: { code: `customer.${issue.customer_id}`, kind: 'asset' },
      credit: { code: `voucher.product.${issue.product_id}`, kind: 'liability' },
      amountMinor: count * issue.face_minor,
    });
  const runtime = new PgRuntimeWriter(database);
  if (count > 0) {
    await database.query(`update voucher.issuebatch set accounted=$3,version=version+1 where id=$1 and scope_id=$2`, [input.batch, input.scope, progress.succeeded]);
    await new PgTransactionalOutbox().append(
      context,
      voucherIssued({ id: issuedEvent, scope: input.scope, batch: input.batch, count, amountMinor: count * issue.face_minor, actor: context.actor, trace: input.job, version: accounted.version + 1, occurredAt: new Date().toISOString() })
    );
  }
  if (progress.failed > 0)
    await runtime.append({
      id: eventId(`issuefailed:${input.batch}`),
      type: 'voucher.issue.failed',
      aggregateType: 'issuebatch',
      aggregate: input.batch,
      scope: input.scope,
      trace: input.job,
      payload: { batch: input.batch, error: 'VOUCHER_STOCK_INSUFFICIENT' },
    });
  return true;
}

export function options(scope: string, trace: string, action: string, signal: AbortSignal, deadline: number): TransactionOptions {
  return { tenant: scope, membership: '', scope, actor: 'system:voucher', trace, operation: `job.voucher.${action}`, workload: 'jobs', signal, deadline };
}
export function available(input: Pick<Parameters<IssueBatchWork['issue']>[0], 'signal' | 'deadline'>): void {
  if (input.signal.aborted) throw input.signal.reason ?? new Error('VOUCHER_ISSUE_ABORTED');
  if (Date.now() >= input.deadline) throw new Error('DEADLINE_EXCEEDED');
}
export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export function eventId(value: string): string {
  const hash = digest(value);
  return `event:${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value === '') throw new Error(code);
  return value;
}
export function integer(value: unknown, code: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(code);
  return result;
}
