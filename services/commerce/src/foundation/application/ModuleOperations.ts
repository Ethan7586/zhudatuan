import { DomainError } from '../domain/DomainError';
import { createHash } from 'node:crypto';
import { permissionDefinition } from '@shop/authz';
import { errorStatus, OperationCatalog, type ErrorCode, type OperationId } from '@shop/contract';
import type { QueryResult, QueryResultRow } from 'pg';
import type { DatabasePool } from '../persistence/Pool';
import { PgUnitOfWork } from '../../adapter/database/PgUnitOfWork';
import type { OperationRequest, OperationResult, OperationUsecase } from './OperationExecution';
import { TransactionRunner } from './TransactionRunner';
import type { AuditSink } from './AuditSink';
import { requireSession, sessionAccess } from '../security/OperationSecurityContext';
import { MakerCheckerPolicy } from '../security/MakerCheckerPolicy';
import { operationRequestHash } from './OperationHash';
import type { ErrorDetail } from '../domain/ApplicationError';
import { appendOperationAudit } from './OperationAudit';
export { appendOperationAudit } from './OperationAudit';

export interface OperationDatabase {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export type OperationAction = (request: OperationRequest, database: OperationDatabase) => Promise<OperationResult>;
export interface OperationLifecycle<T = unknown, L = undefined> {
  load?(request: OperationRequest, database: OperationDatabase): Promise<L>;
  prepare?(request: OperationRequest, loaded: L): Promise<T>;
  shortCircuit?(request: OperationRequest, preparation: T): OperationResult | undefined;
  execute(request: OperationRequest, database: OperationDatabase, preparation: T): Promise<OperationResult>;
  finalize?(request: OperationRequest, result: OperationResult, preparation: T): Promise<OperationResult>;
  /** Persist a commit checkpoint before an external finalization step. */
  readonly durableFinalize?: boolean;
  discard?(request: OperationRequest, preparation: T, cause: unknown): Promise<void>;
}
type OperationEntry = OperationAction | OperationLifecycle<unknown, unknown>;
export type OperationActions = Readonly<Partial<Record<OperationId, OperationEntry>>>;

export function operationLifecycle<T, L = undefined>(definition: OperationLifecycle<T, L>): OperationLifecycle<T, L> {
  return definition;
}

export class OperationRejection extends Error {
  readonly result: OperationResult;

  constructor(
    readonly code: ErrorCode,
    readonly details?: Readonly<Record<string, ErrorDetail>>
  ) {
    super(code);
    this.name = 'OperationRejection';
    const status = errorStatus(code);
    if (status === undefined) throw new Error('ERROR_CONTRACT_MISSING');
    this.result = { status, body: { code, ...(details === undefined ? {} : { details }) } };
  }
}

export function reject(code: ErrorCode, details?: Readonly<Record<string, ErrorDetail>>): never {
  throw new OperationRejection(code, details);
}

export class ModuleOperations implements OperationUsecase {
  private readonly actions: ReadonlyMap<OperationId, OperationEntry>;
  private readonly query: TransactionRunner;
  private readonly command: TransactionRunner;
  private readonly makerChecker = new MakerCheckerPolicy();

  constructor(
    private readonly module: string,
    private readonly pool: DatabasePool,
    private readonly audit: AuditSink,
    actions: OperationActions,
    owned?: readonly OperationId[]
  ) {
    this.actions = new Map(Object.entries(actions) as [OperationId, OperationEntry][]);
    const expected = [
      ...(owned ??
        OperationCatalog.all()
          .filter((operation) => operation.module === module)
          .map((operation) => operation.id)),
    ].sort();
    const actual = [...this.actions.keys()].sort();
    if (expected.join('\n') !== actual.join('\n')) throw new Error(`MODULE_OPERATION_CATALOG_MISMATCH:${module}`);
    this.query = new TransactionRunner(new PgUnitOfWork(pool.workload('query')));
    this.command = new TransactionRunner(new PgUnitOfWork(pool.workload('command')));
  }

  async invoke(request: OperationRequest): Promise<OperationResult> {
    if (request.input.signal.aborted || request.input.deadline <= Date.now()) throw request.input.signal.reason ?? new DomainError('DEADLINE_EXCEEDED');
    const operation = OperationCatalog.get(request.type);
    if (operation.module !== this.module) throw new Error(`MODULE_OPERATION_OWNER_MISMATCH:${request.type}`);
    const action = this.actions.get(request.type);
    if (!action) throw new Error(`OPERATION_ACTION_MISSING:${request.type}`);
    const lifecycle = typeof action === 'function' ? undefined : action;
    const loaded = lifecycle?.load ? await this.query.run(transactionContext(request, this.module, 'query'), (database) => lifecycle.load!(request, database)) : undefined;
    const preparation = lifecycle?.prepare ? await lifecycle.prepare(request, loaded) : loaded;
    const immediate = lifecycle?.shortCircuit?.(request, preparation);
    if (immediate) {
      if (operation.method !== 'GET') throw new Error('WRITE_SHORT_CIRCUIT_FORBIDDEN');
      return immediate;
    }
    const execute: OperationAction = typeof action === 'function' ? action : (preparedRequest, database) => action.execute(preparedRequest, database, preparation);
    try {
      const result = operation.method === 'GET' ? await this.read(request, execute) : await this.write(request, execute, lifecycle?.durableFinalize === true);
      if (!lifecycle?.finalize) return result;
      const finalized = await lifecycle.finalize(request, result, preparation);
      if (lifecycle.durableFinalize === true) await this.completeFinalization(request, finalized);
      return finalized;
    } catch (cause) {
      await lifecycle?.discard?.(request, preparation, cause);
      throw cause;
    }
  }

  private read(request: OperationRequest, action: OperationAction): Promise<OperationResult> {
    return this.query.run(transactionContext(request, this.module, 'query'), async (client) => {
      const result = await action(request, client);
      const operation = OperationCatalog.get(request.type);
      const access = sessionAccess(request.security);
      if (access && operation.permission && ['high', 'critical'].includes(permissionDefinition(operation.permission).risk)) {
        await this.audit.access(client, {
          scope: access.scope.id,
          actor: access.actor.id,
          actorType: access.actor.target,
          resourceType: this.module,
          resource: Object.values(request.input.path)[0] ?? access.scope.id,
          fields: { operation: request.type, permission: operation.permission, projection: projection(result.body) },
          purpose: request.type,
          trace: access.trace,
        });
      }
      return result;
    });
  }

  private write(request: OperationRequest, action: OperationAction, durableFinalize: boolean): Promise<OperationResult> {
    const key = request.input.idempotency;
    if (!key) throw new DomainError('IDEMPOTENCY_KEY_REQUIRED');
    return this.command.run(transactionContext(request, this.module, 'command'), async (client) => {
      const hash = operationRequestHash(request);
      const access = sessionAccess(request.security);
      const actor = access?.actor.id ?? publicActor(request);
      const scope = access?.scope.id ?? publicOperationScope(request, this.module);
      await client.query(
        `insert into runtime.idempotency(scope,actor_id,operation,key,request_hash,state,expires_at)
        values($1,$2,$3,$4,$5,'started',clock_timestamp()+interval '24 hours') on conflict do nothing`,
        [scope, actor, request.type, key, hash]
      );
      const accepted = await client.query<{ request_hash: string; state: string; response: OperationResult | null }>(
        'select request_hash,state,response from runtime.idempotency where scope=$1 and actor_id=$2 and operation=$3 and key=$4 for update',
        [scope, actor, request.type, key]
      );
      const record = accepted.rows[0];
      if (!record || record.request_hash !== hash) throw new DomainError('IDEMPOTENCY_KEY_REUSED');
      if (record.state === 'completed' && record.response !== null) {
        return record.response;
      }
      if (record.state === 'checkpointed' && record.response !== null) return record.response;
      await this.makerChecker.consume(client, request);
      let result: OperationResult;
      try {
        result = await action(request, client);
      } catch (cause) {
        if (!(cause instanceof OperationRejection)) throw cause;
        result = cause.result;
      }
      await appendOperationAudit(this.audit, client, request, this.module, result, actor, scope, hash);
      const replay = idempotencyReplayResponse(request, result);
      const resource = operationResource(result);
      if (durableFinalize) {
        await client.query(
          `update runtime.idempotency set state='checkpointed',response=$5::jsonb,checkpoint=$6::jsonb,
          resource_type=$7,resource_id=$8,response_hash=$9
          where scope=$1 and actor_id=$2 and operation=$3 and key=$4`,
          [scope, actor, request.type, key, JSON.stringify(replay), JSON.stringify({ phase: 'committed', paymentId: resource.paymentId }), resource.type, resource.id, digest(JSON.stringify(replay))]
        );
      } else {
        await client.query(
          `update runtime.idempotency set state='completed',response=$5::jsonb,checkpoint=$6::jsonb,
          resource_type=$7,resource_id=$8,response_hash=$9
          where scope=$1 and actor_id=$2 and operation=$3 and key=$4`,
          [scope, actor, request.type, key, JSON.stringify(replay), JSON.stringify({ phase: 'completed' }), resource.type, resource.id, digest(JSON.stringify(replay))]
        );
      }
      return result;
    });
  }

  private async completeFinalization(request: OperationRequest, result: OperationResult): Promise<void> {
    const access = sessionAccess(request.security);
    const actor = access?.actor.id ?? publicActor(request);
    const scope = access?.scope.id ?? publicOperationScope(request, this.module);
    await this.command.run(transactionContext(request, this.module, 'command'), async (client) => {
      const replay = idempotencyReplayResponse(request, result);
      const changed = await client.query(
        `update runtime.idempotency set state='completed',response=$5::jsonb,checkpoint=$6::jsonb,response_hash=$7
        where scope=$1 and actor_id=$2 and operation=$3 and key=$4 and request_hash=$8 and state in('checkpointed','completed')`,
        [scope, actor, request.type, request.input.idempotency!, JSON.stringify(replay), JSON.stringify({ phase: 'completed' }), digest(JSON.stringify(replay)), operationRequestHash(request)]
      );
      if ((changed.rowCount ?? 0) !== 1) throw new Error('IDEMPOTENCY_CHECKPOINT_MISSING');
    });
  }
}

export function rowResult<T extends QueryResultRow>(result: QueryResult<T>, status = 200): OperationResult {
  const row = result.rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return { status, body: row, ...(Reflect.has(row, 'version') ? { headers: { etag: `\"${String(Reflect.get(row, 'version'))}\"` } } : {}) };
}

export function pageResult<T extends QueryResultRow>(result: QueryResult<T>): OperationResult {
  return { status: 200, body: { items: result.rows, count: result.rows.length } };
}

export function requireAccess(request: OperationRequest) {
  return requireSession(request.security);
}

function transactionContext(request: OperationRequest, module: string, workload: 'query' | 'command') {
  const access = sessionAccess(request.security);
  const actor = access?.actor.id ?? (workload === 'command' ? publicActor(request) : 'public:query');
  return { tenant: access?.scope.tenant ?? '', membership: access?.membership.id ?? '', scope: access?.scope.id ?? publicOperationScope(request, module), actor, trace: access?.trace ?? actor, operation: request.type, workload } as const;
}

function publicActor(request: OperationRequest): string {
  const actor = request.input.publicActor;
  if (!actor || !/^public:[0-9a-f]{64}$/.test(actor)) throw new Error('PUBLIC_IDEMPOTENCY_ACTOR_REQUIRED');
  return actor;
}

export function publicOperationScope(request: OperationRequest, module: string): string {
  const target = request.security.kind === 'session' ? request.security.access.actor.target : request.security.target;
  const partition = target ?? (request.security.kind === 'anonymous' ? request.security.channel : 'preauth');
  return `public:${module}:${partition}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function operationResource(result: OperationResult): Readonly<{ type: string | null; id: string | null; paymentId: string | null }> {
  if (!result.body || typeof result.body !== 'object' || Array.isArray(result.body)) return Object.freeze({ type: null, id: null, paymentId: null });
  const body = result.body as Readonly<Record<string, unknown>>;
  const nested = body.order && typeof body.order === 'object' && !Array.isArray(body.order) ? (body.order as Readonly<Record<string, unknown>>) : body;
  const payment = body.payment && typeof body.payment === 'object' && !Array.isArray(body.payment) ? (body.payment as Readonly<Record<string, unknown>>) : {};
  const id = typeof nested.id === 'string' ? nested.id : null;
  return Object.freeze({ type: id ? (id.includes(':') ? id.slice(0, id.indexOf(':')) : 'resource') : null, id, paymentId: typeof payment.paymentId === 'string' ? payment.paymentId : null });
}

function idempotencyReplayResponse(request: OperationRequest, result: OperationResult): OperationResult {
  if (
    request.type === 'identity.sessions.create' ||
    request.type === 'identity.sessions.complete' ||
    request.type === 'identity.tickets.exchange' ||
    request.type === 'identity.invitations.create' ||
    request.type === 'identity.enrollments.complete' ||
    request.type === 'identity.federations.start'
  ) {
    return { status: 409, body: { code: 'IDEMPOTENCY_REPLAY_FORBIDDEN' } };
  }
  return result;
}

function projection(value: unknown): readonly string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.length === 0 ? [] : projection(value[0]);
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .slice(0, 100);
}
