import { describe, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
<<<<<<< HEAD
import { appendOperationAudit, ModuleOperations, operationLifecycle, operationRequestHash } from './ModuleOperations';
=======
import { appendOperationAudit, ModuleOperations, operationLifecycle } from './ModuleOperations';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import type { OperationRequest } from './OperationHandler';
import type { DatabasePool } from '../persistence/Pool';
import type { AuditSink } from './AuditSink';

describe('ModuleOperations lifecycle', () => {
<<<<<<< HEAD
  it('does not persist an enumerable phone fingerprint for invitation idempotency', () => {
    const request = (destination: string, label = '普通管理员邀请'): OperationRequest => ({
      type:'identity.invitations.create', access:null,
      input:{ path:{}, query:{}, headers:{}, body:{ label, destination, targetClient:'operator' }, rawBody:'',
        deadline:Date.now()+1_000, signal:new AbortController().signal, idempotency:'invitation-private' },
    });
    expect(operationRequestHash(request('+8613800138000'))).toBe(operationRequestHash(request('+8613900139000')));
    expect(operationRequestHash(request('+8613800138000', '另一个邀请')))
      .not.toBe(operationRequestHash(request('+8613800138000')));
  });

=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
      body:{ address:'敏感地址', password:'secret' }, rawBody:'', deadline:Date.now()+1_000,
      signal:new AbortController().signal, idempotency:'invitation' } } satisfies OperationRequest;
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'identity', { status:201, body:{ id:'invitation:1', code:'one-time-code' } }, 'actor', 'scope', 'hash');
<<<<<<< HEAD
    expect(fact?.before).toEqual({ path:{}, query:{}, body:{ redacted:true }, expectedVersion:null });
    expect(fact?.after).toEqual({ id:'invitation:1', code:'[REDACTED]' });
  });

  it('removes registration OTP and identity subjects from audit hashes and evidence', async () => {
    const facts: Array<Readonly<{ before: unknown; after: unknown; evidence: unknown; trace: string }>> = [];
    const audit: AuditSink = { record: async (_database, input) => { facts.push(input); }, access: async () => undefined };
    const request = (subject: string, code: string): OperationRequest => ({
      type:'identity.members.create', access:null, input:{ path:{}, query:{}, headers:{},
        body:{ subject, password:'Strong-Password-1!', invite:'private-invite', challenge:'private-challenge', code,
          displayName:'测试会员', termsAccepted:true, termsHash:'safe-terms-hash', reason:code,
          unknownPayload:{ mobile:subject, otp:code } }, rawBody:'', deadline:Date.now()+1_000,
        signal:new AbortController().signal, idempotency:'registration-audit' },
    });

    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) },
      request('+85291234567', '123456'), 'identity', { status:201, body:{ member_id:'member:1' } },
      'public:identity.members.create', 'public:identity', 'raw-request-hash-one');
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) },
      request('+85366123456', '654321'), 'identity', { status:201, body:{ member_id:'member:1' } },
      'public:identity.members.create', 'public:identity', 'raw-request-hash-two');

    const serialized = JSON.stringify(facts);
    for (const secret of ['+85291234567', '+85366123456', '123456', '654321', 'Strong-Password-1!', 'private-invite',
      'private-challenge', 'raw-request-hash-one', 'raw-request-hash-two']) expect(serialized).not.toContain(secret);
    expect(facts[0]?.before).toEqual({ path:{}, query:{}, body:{ termsAccepted:true, termsHash:'safe-terms-hash', redacted:true },
      expectedVersion:null });
    expect((facts[0]?.evidence as { requestHash?: string }).requestHash)
      .toBe((facts[1]?.evidence as { requestHash?: string }).requestHash);
    expect((facts[0]?.evidence as { idempotency?: string; reason?: unknown })).toMatchObject({ idempotency:'[REDACTED]', reason:null });
    expect(facts[0]?.trace).not.toBe(facts[1]?.trace);
    expect(facts[0]?.trace).toMatch(/^audit:[0-9a-f-]{36}$/);
  });

  it('never records the destination of an authenticated mobile challenge', async () => {
    let fact: Readonly<{ before?: unknown; evidence?: unknown }> | undefined;
    const audit: AuditSink = { record: async (_database, input) => { fact = input; }, access: async () => undefined };
    const request = { type:'identity.mobile.challenge', access:null, input:{ path:{}, query:{}, headers:{},
      body:{ destination:'+8613800138000' }, rawBody:'', deadline:Date.now()+1_000,
      signal:new AbortController().signal, idempotency:'private-mobile-challenge' } } satisfies OperationRequest;

    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'identity', { status:202, body:{ id:'challenge:one' } }, 'principal:one', 'self:principal:one', 'raw-mobile-hash');

    expect(fact?.before).toEqual({ path:{}, query:{}, body:{ redacted:true }, expectedVersion:null });
    const serialized = JSON.stringify(fact);
    for (const secret of ['+8613800138000', 'private-mobile-challenge', 'raw-mobile-hash']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('removes ticket exchange credentials and signed return proofs from audit facts', async () => {
    let fact: Readonly<{ before: unknown; after: unknown; evidence: unknown; trace: string }> | undefined;
    const audit: AuditSink = { record: async (_database, input) => { fact = input; }, access: async () => undefined };
    const request = { type:'identity.tickets.exchange', access:null, input:{ path:{}, query:{}, headers:{},
      body:{ ticket:'private-ticket', state:'private-state', nonce:'private-nonce', verifier:'private-verifier' }, rawBody:'',
      deadline:Date.now()+1_000, signal:new AbortController().signal, idempotency:'ticket-audit' } } satisfies OperationRequest;
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'identity', { status:200, body:{ returnTarget:{ url:'https://zhudatuan.com/', proof:'private-proof',
        expiresAt:'2026-08-29T06:00:00.000Z' }, expiresIn:3600 } }, 'public:identity.tickets.exchange', 'public:identity',
      'raw-ticket-request-hash');

    expect(fact?.before).toEqual({ path:{}, query:{}, body:{ redacted:true }, expectedVersion:null });
    expect(fact?.after).toEqual({ returnTarget:{ url:'https://zhudatuan.com/', proof:'[REDACTED]',
      expiresAt:'2026-08-29T06:00:00.000Z' }, expiresIn:3600 });
    const serialized = JSON.stringify(fact);
    for (const secret of ['private-ticket', 'private-state', 'private-nonce', 'private-verifier', 'private-proof',
      'raw-ticket-request-hash']) expect(serialized).not.toContain(secret);
  });

  it('keeps member-management credentials and arbitrary reason text out of audit evidence', async () => {
    let fact: Readonly<{ before: unknown; evidence: unknown; trace: string }> | undefined;
    const audit: AuditSink = { record: async (_database, input) => { fact = input; }, access: async () => undefined };
    const request = { type:'identity.members.manage', access:{
      actor:{ id:'owner:1', session:'session:1', membership:'membership:owner', credentialVersion:1, accessVersion:1,
        target:'console', assurance:{ level:2 } },
      membership:{ id:'membership:owner', active:true, accessVersion:1, denies:[], grants:[] },
      scope:{ kind:'enterprise', id:'organization:1', tenant:'tenant:1', path:[] }, accessVersion:1, capabilities:[],
      assurance:{ level:2 }, trace:'private-client-trace' }, input:{ path:{ membershipid:'new' }, query:{}, headers:{},
      body:{ action:'create', username:'private-username', password:'Private-Password-1!', reason:'otp 123456',
        unknown:{ ticket:'private-ticket' } }, rawBody:'', deadline:Date.now()+1_000, signal:new AbortController().signal,
      idempotency:'member-management-audit' } } satisfies OperationRequest;
    await appendOperationAudit(audit, { query:async () => ({ rows:[], rowCount:0 } as unknown as QueryResult) }, request,
      'identity', { status:201, body:{ membershipId:'membership:1' } }, 'owner:1', 'organization:1', 'raw-member-hash');

    expect(fact?.before).toEqual({ path:{ membershipid:'new' }, query:{}, body:{ action:'create', redacted:true }, expectedVersion:null });
    expect((fact?.evidence as { idempotency?: string; reason?: unknown })).toMatchObject({ idempotency:'[REDACTED]', reason:null });
    const serialized = JSON.stringify(fact);
    for (const secret of ['private-username', 'Private-Password-1!', '123456', 'private-ticket', 'private-client-trace', 'raw-member-hash',
      'member-management-audit']) expect(serialized).not.toContain(secret);
  });

=======
    expect(fact?.before).toEqual({ path:{}, query:{}, body:{ address:'[REDACTED]', password:'[REDACTED]' }, expectedVersion:null });
    expect(fact?.after).toEqual({ id:'invitation:1', code:'[REDACTED]' });
  });

>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD

  it('uses a stable public actor so the same idempotency key cannot be reused with a different body', async () => {
    let stored: Readonly<{ request_hash: string; state: string; response: unknown }> | undefined;
    let executions = 0;
    const insertedActors: unknown[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.includes('insert into runtime.idempotency')) {
          insertedActors.push(values[1]);
          if (stored === undefined) stored = { request_hash: String(values[3]), state: 'started', response: null };
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
    const operations = new ModuleOperations('identity', pool, audit, {
      'identity.members.create': async () => {
        executions += 1;
        return { status: 201, body: { member: 'member:one' } };
      },
    }, ['identity.members.create']);
    const request = (display: string): OperationRequest => ({
      type: 'identity.members.create', access: null,
      input: { path: {}, query: {}, headers: {}, body: { display }, rawBody: JSON.stringify({ display }),
        deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'public-same-key' },
    });

    await expect(operations.invoke(request('First'))).resolves.toMatchObject({ status: 201 });
    await expect(operations.invoke(request('Second'))).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(executions).toBe(1);
    expect(insertedActors).toEqual(['public:identity.members.create', 'public:identity.members.create']);
  });

  it('binds idempotency to the expected resource version', async () => {
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
        return { status: 200, body: { version: 2 } };
      },
    }, ['cart.items.put']);
    const request = (expectedVersion: number): OperationRequest => ({
      type: 'cart.items.put', access: null,
      input: { path: { listingid: 'listing:one' }, query: {}, headers: {}, body: { quantity: 1 }, rawBody: '{"quantity":1}',
        expectedVersion, deadline: Date.now() + 1_000, signal: new AbortController().signal, idempotency: 'version-key' },
    });

    await expect(operations.invoke(request(1))).resolves.toMatchObject({ status: 200 });
    await expect(operations.invoke(request(2))).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
    expect(executions).toBe(1);
  });
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
});
