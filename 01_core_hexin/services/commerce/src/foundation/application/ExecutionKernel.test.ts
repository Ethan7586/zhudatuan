import { describe, expect, it, vi } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { AuditSink } from './AuditSink';
import { appendOperationAudit } from './ModuleOperations';
import {
  assertEnforcedWriteResult,
  assertExecutionTransition,
  currentWriteTx,
  ExecutionKernel,
  normalizeOperationResult,
} from './ExecutionKernel';
import type { OperationRequest, OperationResult } from './OperationHandler';
import { assertActiveWriteTx, type Transaction, type TransactionContext, type WriteTx } from './UnitOfWork';

describe('ExecutionKernel', () => {
  it('executes five concurrent deliveries once and replays one durable result', async () => {
    const fixture = kernelFixture();
    let executions = 0;
    const requests = Array.from({ length: 5 }, () => request('concurrent-key'));
    const results = await Promise.all(requests.map((item) => fixture.kernel.execute(item, 'identity', fixture.transaction,
      context(), async (activeRequest) => {
        executions += 1;
        expect(currentWriteTx(activeRequest).mode).toBe('write');
        return { status: 201, body: { member: 'member:one' } };
      }, (_request, result) => result)));

    expect(executions).toBe(1);
    expect(new Set(results.map((result) => JSON.stringify(result))).size).toBe(1);
    expect(fixture.store.outbox.size).toBe(1);
    expect(fixture.audit.record).toHaveBeenCalledTimes(1);
    results.forEach((result, index) => assertEnforcedWriteResult(requests[index]!, result));
  });

  it('rejects a reused key with a different request hash', async () => {
    const fixture = kernelFixture();
    const execute = (item: OperationRequest): Promise<OperationResult> => fixture.kernel.execute(item, 'identity', fixture.transaction,
      context(), async () => ({ status: 201, body: { member: 'member:one' } }), (_request, result) => result);
    await execute(request('same-key', 'First'));
    await expect(execute(request('same-key', 'Second'))).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(fixture.store.outbox.size).toBe(1);
  });

  it('rolls back every checkpoint and permits a unique retry after an injected failure', async () => {
    const fixture = kernelFixture();
    const failed = request('retry-key');
    await expect(fixture.kernel.execute(failed, 'identity', fixture.transaction, context(), async () => {
      throw new Error('INJECTED_FAILURE');
    }, (_request, result) => result)).rejects.toThrow('INJECTED_FAILURE');
    expect(fixture.store.idempotency.size).toBe(0);
    expect(fixture.store.outbox.size).toBe(0);
    expect(fixture.audit.record).not.toHaveBeenCalled();

    const retry = request('retry-key');
    const result = await fixture.kernel.execute(retry, 'identity', fixture.transaction, context(),
      async () => ({ status: 201, body: { member: 'member:retry' } }), (_request, value) => value);
    expect(result.status).toBe(201);
    expect(fixture.store.idempotency.size).toBe(1);
    expect(fixture.store.outbox.size).toBe(1);
  });

  it('requires an idempotency key and rejects invalid state transitions', async () => {
    const fixture = kernelFixture();
    await expect(fixture.kernel.execute(request(undefined), 'identity', fixture.transaction, context(),
      async () => ({ status: 201 }), (_request, result) => result)).rejects.toThrow('IDEMPOTENCY_KEY_REQUIRED');
    expect(() => assertExecutionTransition('completed', 'started')).toThrow('STATE_INVALID:completed:started');
  });

  it('preserves successful output without applying the retired response schema', () => {
    const body = { futureField: 'kept', nested: { value: 2 } };
    expect(normalizeOperationResult(request('response-key'), { status: 200, body })).toEqual({ status: 200, body });
  });

  it('invalidates the branded write context immediately after the transaction ends', async () => {
    const fixture = kernelFixture();
    let captured: WriteTx | undefined;
    const item = request('context-key');
    await fixture.kernel.execute(item, 'identity', fixture.transaction, context(), async (activeRequest) => {
      captured = currentWriteTx(activeRequest);
      expect('query' in captured).toBe(false);
      return { status: 201, body: { member: 'member:context' } };
    }, (_request, result) => result);
    expect(() => assertActiveWriteTx(captured!)).toThrow('TRANSACTION_CONTEXT_INACTIVE');
    expect(() => currentWriteTx(item)).toThrow('TRANSACTION_CONTEXT_MISSING');
  });
});

interface IdempotencyRecord {
  request_hash: string;
  state: 'started' | 'completed';
  response: OperationResult | null;
  business_number: string;
  execution_state: 'started' | 'completed';
}

interface KernelStore {
  idempotency: Map<string, IdempotencyRecord>;
  outbox: Map<string, unknown>;
}

function kernelFixture() {
  const store: KernelStore = { idempotency: new Map(), outbox: new Map() };
  const audit: AuditSink = { record: vi.fn(async () => undefined), access: vi.fn(async () => undefined) };
  return { store, audit, kernel: new ExecutionKernel(audit, appendOperationAudit), transaction: new MemoryTransaction(store) };
}

class MemoryTransaction {
  private tail = Promise.resolve();

  constructor(private readonly store: KernelStore) {}

  async run<T>(_context: TransactionContext, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.tail;
    this.tail = previous.then(() => current);
    await previous;
    const snapshot = cloneStore(this.store);
    try {
      return await operation({ query: (text, values) => this.query(text, values) });
    } catch (cause) {
      this.store.idempotency = snapshot.idempotency;
      this.store.outbox = snapshot.outbox;
      throw cause;
    } finally {
      release();
    }
  }

  private async query<R extends QueryResultRow = QueryResultRow>(text: string,
    values: readonly unknown[] = []): Promise<QueryResult<R>> {
    if (text.includes('insert into runtime.idempotency')) {
      const key = `${values[0]}|${values[1]}|${values[2]}`;
      if (!this.store.idempotency.has(key)) this.store.idempotency.set(key, {
        request_hash: String(values[3]), state: 'started', response: null,
        business_number: String(values[5]), execution_state: 'started',
      });
      return result([], 1);
    }
    if (text.startsWith('select request_hash,state,response')) {
      const key = `${values[0]}|${values[1]}|${values[2]}`;
      const row = this.store.idempotency.get(key);
      return result(row ? [row] : [], row ? 1 : 0) as unknown as QueryResult<R>;
    }
    if (text.includes('insert into runtime.outbox')) {
      this.store.outbox.set(String(values[0]), values[3]);
      return result([], 1);
    }
    if (text.includes("update runtime.idempotency set state='completed'")) {
      const key = `${values[0]}|${values[1]}|${values[2]}`;
      const row = this.store.idempotency.get(key);
      if (!row || row.request_hash !== values[4]) return result([], 0);
      this.store.idempotency.set(key, { ...row, state: 'completed', execution_state: 'completed',
        response: JSON.parse(String(values[3])) as OperationResult });
      return result([], 1);
    }
    return result([], 0);
  }
}

function cloneStore(store: KernelStore): KernelStore {
  return {
    idempotency: new Map([...store.idempotency].map(([key, value]) => [key, structuredClone(value)])),
    outbox: new Map([...store.outbox].map(([key, value]) => [key, structuredClone(value)])),
  };
}

function result<R extends QueryResultRow>(rows: readonly R[], rowCount: number): QueryResult<R> {
  return { rows: [...rows], rowCount } as QueryResult<R>;
}

function request(idempotency: string | undefined, display = 'First'): OperationRequest {
  return {
    type: 'identity.members.create', access: null,
    input: { path: {}, query: {}, headers: {}, body: { display }, rawBody: JSON.stringify({ display }),
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
      ...(idempotency === undefined ? {} : { idempotency }) },
  };
}

function context(): TransactionContext {
  return { tenant: 'public:identity', membership: '', scope: 'public:identity', actor: 'public:identity.members.create',
    trace: 'trace:test', workload: 'command' };
}
