import { describe, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import { appendOperationAudit, ModuleOperations, operationLifecycle } from './ModuleOperations';
import type { OperationRequest, OperationResult } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';
import type { AuditSink } from './AuditSink';

describe('ModuleOperations lifecycle', () => {
  it('keeps client error payloads in telemetry and out of audit facts', async () => {
    let before: unknown;
    const audit: AuditSink = {
      record: async (_database, input) => {
        before = input.before;
      },
      access: async () => undefined,
    };
    const request = {
      type: 'observability.clienterrors.create',
      access: null,
      input: { path: {}, query: {}, headers: {}, body: { message: 'secret diagnostic', stack: 'private stack' }, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'telemetry' },
    } satisfies OperationRequest;
    await appendOperationAudit(audit, { query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult }, request, 'observability', { status: 202, body: { faultCode: 'SW-TEST-TEST' } }, 'actor', 'scope', 'hash');
    expect(before).toEqual({ path: {}, query: {}, body: { redacted: true }, expectedVersion: null });
  });

  it('redacts PII and one-time credentials from audit facts', async () => {
    let fact: Readonly<{ before?: unknown; after?: unknown }> | undefined;
    const audit: AuditSink = {
      record: async (_database, input) => {
        fact = input;
      },
      access: async () => undefined,
    };
    const request = {
      type: 'identity.invitations.create',
      access: null,
      input: { path: {}, query: {}, headers: {}, body: { address: '敏感地址', password: 'secret' }, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'invitation' },
    } satisfies OperationRequest;
    await appendOperationAudit(audit, { query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult }, request, 'identity', { status: 201, body: { id: 'invitation:1', code: 'one-time-code' } }, 'actor', 'scope', 'hash');
    expect(fact?.before).toEqual({ path: {}, query: {}, body: { address: '[REDACTED]', password: '[REDACTED]' }, expectedVersion: null });
    expect(fact?.after).toEqual({ id: 'invitation:1', code: '[REDACTED]' });
  });

  it('records only a digest of an action proof in immutable audit evidence', async () => {
    let evidence: unknown;
    const audit: AuditSink = {
      record: async (_database, input) => {
        evidence = input.evidence;
      },
      access: async () => undefined,
    };
    const request = {
      type: 'finance.settlements.decide',
      access: null,
      input: {
        path: { settlementid: 'settlement:one' },
        query: {},
        headers: { 'x-action-proof': 'single-use-proof' },
        body: { decision: 'approved', reason: 'verified' },
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'decision:one',
        expectedVersion: 7,
      },
    } satisfies OperationRequest;
    await appendOperationAudit(audit, { query: async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult }, request, 'finance', { status: 200, body: { id: 'settlement:one', version: 8 } }, 'actor', 'scope', 'request-hash');
    expect(evidence).toMatchObject({ actionProofHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(JSON.stringify(evidence)).not.toContain('single-use-proof');
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
    const operations = new ModuleOperations(
      'cart',
      pool,
      audit,
      {
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
      },
      ['cart.current.read']
    );
    const request: OperationRequest = {
      type: 'cart.current.read',
      access: null,
      input: { path: {}, query: {}, headers: {}, body: null, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal },
    };

    await expect(operations.invoke(request)).resolves.toEqual({
      status: 200,
      body: { source: 'database' },
      headers: { finalized: 'true' },
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
    const operations = new ModuleOperations(
      'cart',
      pool,
      audit,
      {
        'cart.items.put': async () => {
          executions += 1;
          return { status: 201, body: { version: 1 } };
        },
      },
      ['cart.items.put']
    );
    const access = {
      actor: { id: 'member:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: { level: 1 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { kind: 'self', id: 'member:one', tenant: 'tenant:one', path: [] },
      accessVersion: 1,
      capabilities: [],
      assurance: { level: 1 },
      trace: 'trace:first',
    } as const;
    const first: OperationRequest = {
      type: 'cart.items.put',
      access,
      input: {
        path: { listingid: 'listing:one' },
        query: {},
        headers: { 'x-request-id': 'first' },
        body: { quantity: 1 },
        rawBody: '{"quantity":1}',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'same-key',
      },
    };
    const second: OperationRequest = {
      ...first,
      input: { ...first.input, headers: { 'x-request-id': 'second' }, deadline: first.input.deadline + 500 },
    };

    await expect(operations.invoke(first)).resolves.toEqual({ status: 201, body: { version: 1 } });
    await expect(operations.invoke(second)).resolves.toEqual({ status: 201, body: { version: 1 } });
    expect(executions).toBe(1);
  });

  it('rechecks and locks a financial resource version inside the command transaction', async () => {
    let requestHash = '';
    let assertionValues: readonly unknown[] | undefined;
    let consumeValues: readonly unknown[] | undefined;
    const order: string[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) requestHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          order.push('idempotency');
          return { rows: [{ request_hash: requestHash, state: 'started', response: null }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('finance.assert_expected_version')) {
          assertionValues = values;
          order.push('version');
        }
        if (text.includes('access.consume_action_proof')) {
          consumeValues = values;
          order.push('consume');
          return { rows: [{ consumed: true }], rowCount: 1 } as unknown as QueryResult;
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
    const operations = new ModuleOperations(
      'finance',
      pool,
      audit,
      {
        'finance.settlements.decide': async () => {
          order.push('execute');
          return { status: 200, body: { id: 'settlement:one', version: 8 } };
        },
      },
      ['finance.settlements.decide']
    );
    const access = {
      actor: { id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3, verified: new Date() } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { kind: 'platform', id: 'organization:one', path: [] },
      accessVersion: 1,
      capabilities: ['finance.settlements.decide'],
      assurance: { level: 3, verified: new Date() },
      trace: 'trace:one',
    } as const;
    await operations.invoke({
      type: 'finance.settlements.decide',
      access,
      input: {
        path: { settlementid: 'settlement:one' },
        query: {},
        headers: { 'x-action-proof': 'a'.repeat(64) },
        body: { decision: 'approved' },
        rawBody: '{"decision":"approved"}',
        deadline: Date.now() + 1_000,
        signal: new AbortController().signal,
        idempotency: 'decision:one',
        expectedVersion: 7,
        resource: 'settlement:one',
      },
    });
    expect(assertionValues).toEqual(['finance.settlements.decide', 'settlement:one', 'organization:one', 7]);
    expect(consumeValues).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/), 'actor:one', 'session:one', 'membership:one', 'organization:one', 'finance.settlements.decide', 'settlement:one', 'decision:one', 7, requestHash]);
    expect(order).toEqual(['idempotency', 'version', 'consume', 'execute']);
  });

  it('returns a completed financial idempotency replay without consuming a proof or executing again', async () => {
    let storedHash = '';
    let consumeCount = 0;
    let executions = 0;
    const replay = { status: 200, body: { id: 'settlement:one', version: 8 } };
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) storedHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          return { rows: [{ request_hash: storedHash, state: 'completed', response: replay }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('access.consume_action_proof')) consumeCount += 1;
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
    const operations = new ModuleOperations(
      'finance',
      pool,
      { record: async () => undefined, access: async () => undefined },
      {
        'finance.settlements.decide': async () => {
          executions += 1;
          return replay;
        },
      },
      ['finance.settlements.decide']
    );
    const request = financialRequest();

    await expect(operations.invoke(request)).resolves.toEqual(replay);
    expect(consumeCount).toBe(0);
    expect(executions).toBe(0);
  });

  it('rolls proof consumption back when the business command fails', async () => {
    let storedHash = '';
    const order: string[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text === 'begin isolation level serializable' || text === 'rollback') order.push(text);
        if (text.includes('insert into runtime.idempotency')) storedHash = String(values[3]);
        if (text.startsWith('select request_hash,state,response')) {
          return { rows: [{ request_hash: storedHash, state: 'started', response: null }], rowCount: 1 } as unknown as QueryResult;
        }
        if (text.includes('access.consume_action_proof')) {
          order.push('consume');
          return { rows: [{ consumed: true }], rowCount: 1 } as unknown as QueryResult;
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
    const operations = new ModuleOperations(
      'finance',
      pool,
      { record: async () => undefined, access: async () => undefined },
      {
        'finance.settlements.decide': async () => {
          order.push('execute');
          throw new Error('FINANCE_COMMAND_FAILED');
        },
      },
      ['finance.settlements.decide']
    );

    await expect(operations.invoke(financialRequest())).rejects.toThrow('FINANCE_COMMAND_FAILED');
    expect(order).toEqual(['begin isolation level serializable', 'consume', 'execute', 'rollback']);
  });

  it('returns an action proof once without persisting or auditing the bearer', async () => {
    let stored: Readonly<{ request_hash: string; state: string; response: OperationResult | null }> | undefined;
    let persisted = '';
    let audited = '';
    let executions = 0;
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency') && stored === undefined) {
          stored = { request_hash: String(values[3]), state: 'started', response: null };
        } else if (text.startsWith('select request_hash,state,response')) {
          return { rows: stored === undefined ? [] : [stored], rowCount: stored === undefined ? 0 : 1 } as unknown as QueryResult;
        } else if (text.includes("update runtime.idempotency set state='completed'")) {
          persisted = String(values[3]);
          stored = { request_hash: stored!.request_hash, state: 'completed', response: JSON.parse(persisted) as OperationResult };
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
    const proof = 'p'.repeat(64);
    const operations = new ModuleOperations(
      'identity',
      pool,
      {
        record: async (_database, input) => {
          audited = JSON.stringify(input);
        },
        access: async () => undefined,
      },
      {
        'identity.stepup.complete': async () => {
          executions += 1;
          return { status: 200, body: { id: 'session:one', actionProof: { proof, requestHash: 'b'.repeat(64) } } };
        },
      },
      ['identity.stepup.complete']
    );
    const request: OperationRequest = {
      type: 'identity.stepup.complete',
      access: null,
      input: { path: {}, query: {}, headers: {}, body: { challenge: 'challenge:one' }, rawBody: '', deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'stepup:one' },
    };

    await expect(operations.invoke(request)).resolves.toMatchObject({ body: { actionProof: { proof } } });
    await expect(operations.invoke(request)).resolves.toEqual({
      status: 409,
      body: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'ACTION_PROOF_ONE_TIME_RESPONSE' },
    });
    expect(executions).toBe(1);
    expect(persisted).not.toContain(proof);
    expect(audited).not.toContain(proof);
    expect(audited).toContain('[REDACTED]');
  });
});

function financialRequest(): OperationRequest {
  return {
    type: 'finance.settlements.decide',
    access: {
      actor: { id: 'actor:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3, verified: new Date() } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { kind: 'platform', id: 'organization:one', path: [] },
      accessVersion: 1,
      capabilities: ['finance.settlements.decide'],
      assurance: { level: 3, verified: new Date() },
      trace: 'trace:one',
    },
    input: {
      path: { settlementid: 'settlement:one' },
      query: {},
      headers: { 'x-action-proof': 'a'.repeat(64) },
      body: { decision: 'approved' },
      rawBody: '{"decision":"approved"}',
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'decision:one',
      expectedVersion: 7,
      resource: 'settlement:one',
    },
  };
}
