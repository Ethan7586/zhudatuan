import { describe, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import { appendOperationAudit, ModuleOperations, operationLifecycle } from './ModuleOperations';
import type { OperationRequest } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';
import type { AuditSink } from './AuditSink';

describe('ModuleOperations lifecycle', () => {
  it('keeps client error payloads in telemetry and out of audit facts', async () => {
    let before: unknown;
    const audit: AuditSink = { record: async (_database, input) => { before = input.before; }, access: async () => undefined };
    const request = { type:'observability.clienterrors.create', access:null, input:{ path:{}, query:{}, headers:{},
      body:{ message:'secret diagnostic', stack:'private stack' }, rawBody:'', deadline:Date.now()+1_000,
      signal:new AbortController().signal, idempotency:'telemetry' } } satisfies OperationRequest;
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'observability', { status:202, body:{ faultCode:'SW-TEST-TEST' } }, 'actor', 'scope', 'hash');
    expect(before).toEqual({ path:{}, query:{}, body:{ redacted:true }, expectedVersion:null });
  });

  it('redacts PII and one-time credentials from audit facts', async () => {
    let fact: Readonly<{ before?: unknown; after?: unknown }> | undefined;
    const audit: AuditSink = { record: async (_database, input) => { fact = input; }, access: async () => undefined };
    const request = { type:'identity.invitations.create', access:null, input:{ path:{}, query:{}, headers:{},
      body:{ address:'敏感地址', password:'secret', governanceLevel:'senior_administrator' }, rawBody:'', deadline:Date.now()+1_000,
      signal:new AbortController().signal, idempotency:'invitation' } } satisfies OperationRequest;
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'identity', { status:201, body:{ id:'invitation:1', code:'one-time-code' } }, 'actor', 'scope', 'hash');
    expect(fact?.before).toEqual({ path:{}, query:{}, body:{ address:'[REDACTED]', password:'[REDACTED]' }, expectedVersion:null });
    expect(fact?.after).toEqual({ id:'invitation:1', code:'[REDACTED]' });
  });

  it('prepares before acquiring a connection and finalizes after commit and release', async () => {
    const order: string[] = [];
    const client = {
      query: async (text: string) => {
        order.push(text === 'begin' ? 'begin' : text === 'commit' ? 'commit' : 'query');
        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      },
      release: () => order.push('release'),
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => {
        order.push('connect');
        return client;
      },
      query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      workload: () => pool,
      end: async () => undefined,
    };
    const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
    const operations = new ModuleOperations('cart', pool, audit, {
      'cart.current.read': operationLifecycle({
        prepare: async () => {
          order.push('prepare');
          return 'prepared';
        },
        execute: async (_request, _database, preparation) => {
          order.push(`execute:${preparation}`);
          return { status: 200, body: { source: 'database' } };
        },
        finalize: async (_request, result, preparation) => {
          order.push(`finalize:${preparation}`);
          return { ...result, headers: { finalized: 'true' } };
        },
      }),
    }, ['cart.current.read']);
    const request: OperationRequest = {
      type: 'cart.current.read', access: null,
      input: { path: {}, query: {}, headers: {}, body: null, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal },
    };

    await expect(operations.invoke(request)).resolves.toEqual({
      status: 200, body: { source: 'database' }, headers: { finalized: 'true' },
    });
    expect(order).toEqual(['prepare', 'connect', 'begin', 'query', 'execute:prepared', 'commit', 'release', 'finalize:prepared']);
  });

  it('replays a completed response when transport-only request fields change', async () => {
    let stored: Readonly<{ request_hash: string; state: string; response: unknown }> | undefined;
    let executions = 0;
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency') && stored === undefined) {
          stored = { request_hash: String(values[3]), state: 'started', response: null };
        } else if (text.startsWith('select request_hash,state,response')) {
          return { rows: stored === undefined ? [] : [stored], rowCount: stored === undefined ? 0 : 1 } as unknown as QueryResult;
        } else if (text.includes("update runtime.idempotency set state='completed'")) {
          stored = { request_hash: stored!.request_hash, state: 'completed', response: JSON.parse(String(values[3])) };
        }
        return { rows: [], rowCount: 0 } as unknown as QueryResult;
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const pool: DatabasePool = {
      connect: async () => client,
      query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      workload: () => pool,
      end: async () => undefined,
    };
    const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
    const operations = new ModuleOperations('cart', pool, audit, {
      'cart.items.put': async () => {
        executions += 1;
        return { status: 201, body: { version: 1 } };
      },
    }, ['cart.items.put']);
    const access = {
      actor: { id: 'member:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1,
        accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { kind: 'self', id: 'member:one', tenant: 'tenant:one', path: [] },
      accessVersion: 1, capabilities: [], assurance: { level: 1 }, trace: 'trace:first',
    } as const;
    const first: OperationRequest = {
      type: 'cart.items.put', access,
      input: { path: { listingid: 'listing:one' }, query: {}, headers: { 'x-request-id': 'first' }, body: { quantity: 1 }, rawBody: '{"quantity":1}',
        deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'same-key' },
    };
    const second: OperationRequest = {
      ...first,
      input: { ...first.input, headers: { 'x-request-id': 'second' }, deadline: first.input.deadline + 500 },
    };

    await expect(operations.invoke(first)).resolves.toEqual({ status: 201, body: { version: 1 } });
    await expect(operations.invoke(second)).resolves.toEqual({ status: 201, body: { version: 1 } });
    expect(executions).toBe(1);
  });
});
