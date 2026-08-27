import { createHash } from 'node:crypto';
import { permissionDefinition } from '@shop/authz';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { Redactor } from '@shop/telemetry';
import type { QueryResult, QueryResultRow } from 'pg';
import type { DatabasePool } from '../persistence/Pool';
import { PgUnitOfWork } from '../infrastructure/PgUnitOfWork';
import type { OperationRequest, OperationResult, OperationUsecase } from './OperationHandler';
import { TransactionRunner } from './TransactionRunner';
import type { AuditSink } from './AuditSink';

export interface OperationDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export type OperationAction = (request: OperationRequest, database: OperationDatabase) => Promise<OperationResult>;
export interface OperationLifecycle<T = unknown> {
  prepare?(request: OperationRequest): Promise<T>;
  shortCircuit?(request: OperationRequest, preparation: T): OperationResult | undefined;
  execute(request: OperationRequest, database: OperationDatabase, preparation: T): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: T): Promise<OperationResult>;
  discard?(request: OperationRequest, preparation: T, cause: unknown): Promise<void>;
}
type OperationEntry = OperationAction | OperationLifecycle;
export type OperationActions = Readonly<Partial<Record<OperationId, OperationEntry>>>;

export function operationLifecycle<T>(definition: OperationLifecycle<T>): OperationLifecycle {
  return definition as OperationLifecycle;
}

export class OperationRejection extends Error {
  constructor(readonly result: OperationResult) {
    super(String((result.body as { code?: unknown } | undefined)?.code ?? 'OPERATION_REJECTED'));
    this.name = 'OperationRejection';
  }
}

export function reject(status: number, code: string, details?: unknown): never {
  throw new OperationRejection({ status, body: { code, ...(details === undefined ? {} : { details }) } });
}

export class ModuleOperations implements OperationUsecase {
  private readonly actions: ReadonlyMap<OperationId, OperationEntry>;
  private readonly query: TransactionRunner;
  private readonly command: TransactionRunner;

  constructor(private readonly module: string, private readonly pool: DatabasePool, private readonly audit: AuditSink,
    actions: OperationActions, owned?: readonly OperationId[]) {
    this.actions = new Map(Object.entries(actions) as [OperationId, OperationEntry][]);
    const expected = [...(owned ?? OperationCatalog.all().filter((operation) => operation.module === module).map((operation) => operation.id))].sort();
    const actual = [...this.actions.keys()].sort();
    if (expected.join('\n') !== actual.join('\n')) throw new Error(`MODULE_OPERATION_CATALOG_MISMATCH:${module}`);
    this.query = new TransactionRunner(new PgUnitOfWork(pool.workload('query')));
    this.command = new TransactionRunner(new PgUnitOfWork(pool.workload('command')));
  }

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.input.signal.aborted || request.input.deadline <= Date.now()) throw request.input.signal.reason ?? new Error('DEADLINE_EXCEEDED');
    const operation = OperationCatalog.get(request.type);
    if (operation.module !== this.module) throw new Error(`MODULE_OPERATION_OWNER_MISMATCH:${request.type}`);
    const action = this.actions.get(request.type);
    if (!action) throw new Error(`OPERATION_ACTION_MISSING:${request.type}`);
    const lifecycle = typeof action === 'function' ? undefined : action;
    const preparation = lifecycle?.prepare ? await lifecycle.prepare(request) : undefined;
    const immediate = lifecycle?.shortCircuit?.(request, preparation);
    if (immediate) {
      if (operation.method !== 'GET') throw new Error('WRITE_SHORT_CIRCUIT_FORBIDDEN');
      return immediate;
    }
    const execute: OperationAction = typeof action === 'function'
      ? action
      : (preparedRequest, database) => action.execute(preparedRequest, database, preparation);
    try {
      const result = operation.method === 'GET'
        ? await this.read(request, execute)
        : await this.write(request, execute);
      return lifecycle?.finalize ? lifecycle.finalize(request, result, preparation) : result;
    } catch (cause) {
      await lifecycle?.discard?.(request, preparation, cause);
      throw cause;
    }
  }

  private read(request: OperationRequest, action: OperationAction): Promise<OperationResult> {
    return this.query.run(transactionContext(request, this.module, 'query'), async (client) => {
      const result = await action(request, client);
      const operation = OperationCatalog.get(request.type);
      if (request.access && operation.permission && ['high','critical'].includes(permissionDefinition(operation.permission).risk)) {
        await this.audit.access(client, { scope:request.access.scope.id, actor:request.access.actor.id, actorType:request.access.actor.target,
          resourceType:this.module, resource:Object.values(request.input.path)[0] ?? request.access.scope.id,
          fields:{ operation:request.type, permission:operation.permission, projection:projection(result.body) }, purpose:request.type,
          trace:request.access.trace });
      }
      return result;
    });
  }

  private write(request: OperationRequest, action: OperationAction): Promise<OperationResult> {
    const key = request.input.idempotency;
    if (!key) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.command.run(transactionContext(request, this.module, 'command'), async (client) => {
      const hash = operationRequestHash(request);
      const actor = request.access?.actor.id ?? `public:${hash.slice(0, 24)}`;
      const scope = request.access?.scope.id ?? `public:${this.module}`;
      await client.query(`insert into runtime.idempotency(scope,actor_id,key,request_hash,state,expires_at)
        values($1,$2,$3,$4,'started',clock_timestamp()+interval '24 hours') on conflict do nothing`, [scope, actor, key, hash]);
      const accepted = await client.query<{ request_hash: string; state: string; response: OperationResult | null }>(
        'select request_hash,state,response from runtime.idempotency where scope=$1 and actor_id=$2 and key=$3 for update', [scope, actor, key],
      );
      const record = accepted.rows[0];
      if (!record || record.request_hash !== hash) throw new Error('IDEMPOTENCY_KEY_REUSED');
      if (record.state === 'completed' && record.response !== null) {
        return record.response;
      }
      let result: OperationResult;
      try {
        result = await action(request, client);
      } catch (cause) {
        if (!(cause instanceof OperationRejection)) throw cause;
        result = cause.result;
      }
      await appendOperationAudit(this.audit, client, request, this.module, result, actor, scope, hash);
      await client.query(`update runtime.idempotency set state='completed',response=$4::jsonb
        where scope=$1 and actor_id=$2 and key=$3`, [scope, actor, key, JSON.stringify(result)]);
      return result;
    });
  }
}

export async function appendOperationAudit(audit: AuditSink, client: OperationDatabase, request: OperationRequest, module: string,
  result: OperationResult, actor: string, scope: string, requestHashValue: string): Promise<void> {
  const body = request.input.body && typeof request.input.body === 'object' && !Array.isArray(request.input.body)
    ? request.input.body as Record<string, unknown> : {};
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;
  const resource = Object.values(request.input.path)[0] ?? null;
  const operation = OperationCatalog.get(request.type);
  const auditBody = operation.module === 'observability' ? { redacted: true } : request.input.body;
  const redactor = new Redactor();
  const auditResult = operation.id === 'identity.invitations.create' && result.body !== null && typeof result.body === 'object' && !Array.isArray(result.body)
    ? { ...result.body, code: '[REDACTED]' } : result.body;
  await audit.record(client, { scope, actor, actorType:request.access?.actor.target ?? 'public', action:request.type, resourceType:module,
    resource, before:redactor.redact({ path:request.input.path, query:request.input.query, body:auditBody, expectedVersion:request.input.expectedVersion ?? null }),
    after:redactor.redact(auditResult ?? null), evidence:{ status:result.status, idempotency:request.input.idempotency, requestHash:requestHashValue, reason,
      permission:operation.permission ?? null, capabilities:request.access?.capabilities ?? [] },
    trace:request.access?.trace ?? requestHashValue });
}

export function rowResult<T extends QueryResultRow>(result: QueryResult<T>, status = 200): OperationResult {
  const row = result.rows[0];
  if (!row) throw new Error('RESOURCE_NOT_FOUND');
  return { status, body: row, ...(Reflect.has(row, 'version') ? { headers: { etag: `\"${String(Reflect.get(row, 'version'))}\"` } } : {}) };
}

export function pageResult<T extends QueryResultRow>(result: QueryResult<T>): OperationResult {
  return { status: 200, body: { items: result.rows, count: result.rows.length } };
}


export function requireAccess(request: OperationRequest) {
  if (!request.access) throw new Error('AUTHENTICATION_REQUIRED');
  return request.access;
}

function transactionContext(request: OperationRequest, module: string, workload: 'query' | 'command') {
  const access = request.access;
  return { tenant: access?.scope.tenant ?? '', membership: access?.membership.id ?? '', scope: access?.scope.id ?? `public:${module}`,
    actor: access?.actor.id ?? 'public', trace: access?.trace ?? `public:${request.type}`, workload } as const;
}

export function operationRequestHash(request: OperationRequest): string {
  return digest(JSON.stringify({
    type: request.type,
    path: request.input.path,
    query: request.input.query,
    body: request.input.body,
  }));
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function projection(value: unknown): readonly string[] {
  if (!value || typeof value!=='object') return [];
  if (Array.isArray(value)) return value.length===0 ? [] : projection(value[0]);
  return Object.keys(value as Record<string, unknown>).sort().slice(0,100);
}
