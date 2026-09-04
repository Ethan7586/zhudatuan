import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import { appendOperationAudit, operationRequestHash, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export interface PaymentDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export async function claimPaymentRequest(database: OperationDatabase, request: OperationRequest, actor: string,
  scope: string): Promise<OperationResult | undefined> {
  const key = request.input.idempotency!;
  const hash = operationRequestHash(request);
  await database.query(`insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at)
    values($1,$2,$3,$4,'started',clock_timestamp()+interval '24 hours') on conflict do nothing`, [scope, actor, key, hash]);
  const result = await database.query<{ request_hash: string; state: string; response: OperationResult | null }>(
    'select request_hash,state,response from runtime.idempotency where scope=$1 and actor_id=$2 and key=$3 for update', [scope, actor, key]);
  const record = result.rows[0];
  if (!record || record.request_hash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSED');
  return record.state === 'completed' && record.response ? record.response : undefined;
}

export async function completePaymentRequest(audit: AuditSink, database: OperationDatabase, request: OperationRequest,
  result: OperationResult, actor: string, scope: string): Promise<void> {
  await appendOperationAudit(audit, database, request, 'payment', result, actor, scope, operationRequestHash(request));
  await database.query(`update runtime.idempotency set state='completed',response=$4::jsonb where scope=$1 and actor_id=$2 and key=$3`,
  [scope, actor, request.input.idempotency!, JSON.stringify(result)]);
}

export async function paymentTransaction<T>(pool: DatabasePool, request: OperationRequest,
  action: (database: PaymentDatabase) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setPaymentContext(client, request);
    const result = await action(client);
    await client.query('commit');
    return result;
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally {
    client.release();
  }
}

export async function setPaymentContext(client: PoolClient, request: OperationRequest): Promise<void> {
  const access = request.access;
  await applyApiDatabaseContext(client, { tenant: access?.scope.tenant ?? '', membership: access?.membership.id ?? '',
    scope: access?.scope.id ?? 'public:payment', actor: access?.actor.id ?? 'provider:wechat',
    trace: access?.trace ?? request.input.headers['request-id'] ?? request.type });
}

export function paymentProviderHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(['wechatpay-serial', 'wechatpay-timestamp', 'wechatpay-nonce', 'request-id']
    .flatMap((name) => headers[name] ? [[name, headers[name]!]] : []));
}

export function isPaymentOutcomeUnknown(cause: unknown): boolean {
  const code = cause instanceof Error && 'code' in cause && typeof cause.code === 'string' ? cause.code : cause instanceof Error ? cause.message : '';
  return /(?:NETWORK|TIMEOUT|DEADLINE|TRANSPORT)/.test(code);
}

export async function enqueuePaymentRecovery(database: PaymentDatabase, request: string, kind: 'paymentquery' | 'paymentrefund',
  scope: string, payload: Readonly<Record<string, string>>): Promise<void> {
  await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
    values($1,$2,'payment',$3,$4::jsonb,'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [`job:${request}`, kind, scope, JSON.stringify(payload)]);
}
