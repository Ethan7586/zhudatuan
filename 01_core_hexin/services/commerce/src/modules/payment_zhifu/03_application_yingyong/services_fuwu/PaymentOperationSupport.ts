import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import { appendOperationAudit, operationRequestHash, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { claimCriticalWrite, completeCriticalWrite, markEnforcedWriteResult, normalizeOperationResult } from '../../../../foundation/application/ExecutionKernel';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export interface PaymentDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export async function claimPaymentRequest(database: OperationDatabase, request: OperationRequest, actor: string,
  scope: string): Promise<OperationResult | undefined> {
  const claim = await claimCriticalWrite(database, request, 'payment', scope, actor);
  return claim.replay === undefined ? undefined : markEnforcedWriteResult(normalizeOperationResult(request, claim.replay));
}

export async function completePaymentRequest(audit: AuditSink, database: OperationDatabase, request: OperationRequest,
  result: OperationResult, actor: string, scope: string): Promise<void> {
  const claim = await claimCriticalWrite(database, request, 'payment', scope, actor);
  const normalized = normalizeOperationResult(request, result);
  await appendOperationAudit(audit, database, request, 'payment', normalized, actor, claim.scope, operationRequestHash(request));
  await completeCriticalWrite(database, request, claim, normalized);
  markEnforcedWriteResult(result);
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
