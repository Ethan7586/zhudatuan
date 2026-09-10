import { describe, expect, it, vi } from 'vitest';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { TransactionContext } from '../platform/database/TransactionContext';
import type { TransactionManager, TransactionOptions } from '../platform/database/TransactionManager';
import { AuditDecorator } from './AuditDecorator';
import type { IdempotencyRepository } from './IdempotencyRepository';
import { OperationExecutor } from './OperationExecutor';
import type { OperationHandler, StatelessOperationHandler } from './OperationHandler';

describe('OperationExecutor', () => {
  it('executes an explicitly stateless public GET without opening a database transaction', async () => {
    const transactionOrder: string[] = [];
    const execute = vi.fn(async () => ({ status: 200, body: {} as OperationOutputFor<'identity.bootstrap.read'> }));
    const executor = new OperationExecutor(
      fakeTransactions(transactionOrder),
      { claim: vi.fn(), checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const handler: StatelessOperationHandler<'identity.bootstrap.read'> = {
      operation: 'identity.bootstrap.read',
      mode: 'read',
      transaction: 'none',
      execute,
    };

    const context = {
      ...execution('observability.clienterrors.create'),
      operation: 'identity.bootstrap.read' as const,
      headers: { 'x-client-target': 'storefront' },
      security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:1' } as const,
    };
    await expect(executor.execute(handler, {} as OperationInputFor<'identity.bootstrap.read'>, context)).resolves.toMatchObject({ status: 200 });
    expect(execute).toHaveBeenCalledOnce();
    expect(transactionOrder).toEqual([]);
  });

  it('rejects stateless handlers for operations that require authorization permissions', async () => {
    const executor = new OperationExecutor(
      fakeTransactions([]),
      { claim: vi.fn(), checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const handler = {
      operation: 'member.profile.read' as const,
      mode: 'read' as const,
      transaction: 'none' as const,
      execute: vi.fn(),
    };

    await expect(executor.execute(handler, {} as OperationInputFor<'member.profile.read'>, { ...execution('observability.clienterrors.create'), operation: 'member.profile.read' } as never)).rejects.toThrow(
      'STATELESS_HANDLER_FORBIDDEN:member.profile.read'
    );
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('executes write concerns in one transaction and returns the typed reply', async () => {
    const order: string[] = [];
    const commands: unknown[] = [];
    const transactions = fakeTransactions(order);
    const idempotency: IdempotencyRepository = {
      claim: async () => {
        order.push('idempotency.claim');
        return { state: 'started' };
      },
      checkpoint: async () => undefined,
      complete: async () => {
        order.push('idempotency.complete');
      },
    };
    const audit = new AuditDecorator({
      append: async (context, command) => {
        order.push(`audit:${context.id}`);
        commands.push(command);
      },
    });
    const executor = new OperationExecutor(
      transactions,
      idempotency,
      {
        verify: async () => {
          order.push('makerchecker');
        },
      },
      audit,
      {
        append: async (context) => {
          order.push(`outbox:${context.id}`);
        },
      }
    );
    const handler: OperationHandler<'observability.clienterrors.create'> = {
      operation: 'observability.clienterrors.create',
      mode: 'write',
      execute: async () => {
        order.push('handler');
        return { status: 201, body: {} as OperationOutputFor<'observability.clienterrors.create'>, events: [{} as never] };
      },
    };

    const reply = await executor.execute(handler, {} as OperationInputFor<'observability.clienterrors.create'>, execution('observability.clienterrors.create'));

    expect(reply.status).toBe(201);
    expect(order).toEqual(['transaction.write', 'idempotency.claim', 'makerchecker', 'handler', 'audit:transaction:write', 'outbox:transaction:write', 'idempotency.complete']);
    expect(commands[0]).toMatchObject({ request: 'request:1', operation: 'observability.clienterrors.create', outcome: 'succeeded', reason: 'http:201' });
  });

  it('returns a completed idempotency response without invoking the handler', async () => {
    const response = { status: 200, body: {} as OperationOutputFor<'observability.clienterrors.create'> };
    const execute = vi.fn();
    const executor = new OperationExecutor(
      fakeTransactions([]),
      {
        claim: async () => ({ state: 'completed', response }),
        checkpoint: async () => undefined,
        complete: async () => undefined,
      },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const handler: OperationHandler<'observability.clienterrors.create'> = {
      operation: 'observability.clienterrors.create',
      mode: 'write',
      execute,
    };

    expect(await executor.execute(handler, {} as OperationInputFor<'observability.clienterrors.create'>, execution('observability.clienterrors.create'))).toBe(response);
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes provider webhooks without a client idempotency key', async () => {
    const transactionOrder: string[] = [];
    const claim = vi.fn();
    const execute = vi.fn(async () => ({ status: 204, body: {} as OperationOutputFor<'payment.webhooks.wechat'> }));
    const executor = new OperationExecutor(
      fakeTransactions(transactionOrder),
      { claim, checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      {
        append: async () => undefined,
      }
    );
    const handler: OperationHandler<'payment.webhooks.wechat'> = { operation: 'payment.webhooks.wechat', mode: 'write', execute };

    const reply = await executor.execute(handler, {} as OperationInputFor<'payment.webhooks.wechat'>, {
      requestId: 'request:webhook',
      traceId: 'trace:webhook',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'payment.webhooks.wechat',
      headers: {},
      rawBody: '{}',
      security: { kind: 'anonymous', channel: 'webhook', target: null, trace: 'trace:webhook' },
      publicActor: 'provider:wechat',
    });

    expect(reply.status).toBe(204);
    expect(execute).toHaveBeenCalledOnce();
    expect(claim).not.toHaveBeenCalled();
    expect(transactionOrder).toEqual(['transaction.write']);
  });

  it('routes a verified webhook into its immutable business scope', async () => {
    const scopes: string[] = [];
    const transactions: TransactionManager = {
      read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => work(context('read', options)) as Promise<T>,
      write: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['write']>[1]) => {
        scopes.push(options.scope);
        return work(context('write', options)) as Promise<T>;
      },
    };
    const executor = new OperationExecutor(transactions, { claim: vi.fn(), checkpoint: async () => undefined, complete: async () => undefined }, { verify: async () => undefined }, new AuditDecorator({ append: async () => undefined }), {
      append: async () => undefined,
    });
    const handler = {
      operation: 'payment.webhooks.wechat' as const,
      mode: 'write' as const,
      prepare: async () => Object.freeze({ scope: 'mvp:mall' }),
      transactionScope: (_input: unknown, prepared: Readonly<{ scope: string }>) => prepared.scope,
      commit: async () => ({ checkpoint: {}, response: { status: 204, body: {} } }),
      finalize: async () => ({ status: 204, body: {} }),
    };

    await executor.execute(handler, {} as OperationInputFor<'payment.webhooks.wechat'>, {
      requestId: 'request:webhook',
      traceId: 'trace:webhook',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'payment.webhooks.wechat',
      headers: {},
      rawBody: '{}',
      security: { kind: 'anonymous', channel: 'webhook', target: null, trace: 'trace:webhook' },
      publicActor: 'provider:wechat',
    });

    expect(scopes).toEqual(['mvp:mall']);
  });

  it('routes a prepared public identity command into its server-resolved scope', async () => {
    const reads: string[] = [];
    const writes: string[] = [];
    const transactions: TransactionManager = {
      read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => {
        reads.push(options.scope);
        return work(context('read', options)) as Promise<T>;
      },
      write: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['write']>[1]) => {
        writes.push(options.scope);
        return work(context('write', options)) as Promise<T>;
      },
    };
    const executor = new OperationExecutor(
      transactions,
      { claim: async () => ({ state: 'started' }), checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const handler = {
      operation: 'identity.sessions.create' as const,
      mode: 'write' as const,
      load: async () => Object.freeze({ invitation: 'invitation:one', scope: 'mall-zhudatuan' }),
      prepare: async (_input: unknown, _context: unknown, loaded: Readonly<{ invitation: string; scope: string }>) => loaded,
      transactionScope: (_input: unknown, prepared: Readonly<{ scope: string }>) => prepared.scope,
      commit: async () => ({ checkpoint: {}, response: { status: 202, body: {} as OperationOutputFor<'identity.sessions.create'> } }),
      finalize: async () => ({ status: 202, body: {} as OperationOutputFor<'identity.sessions.create'> }),
    };

    await executor.execute(handler, {} as OperationInputFor<'identity.sessions.create'>, {
      requestId: 'request:invitation',
      traceId: 'trace:invitation',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'identity.sessions.create',
      headers: {},
      rawBody: '',
      security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:invitation' },
      publicActor: 'public:invitation',
      idempotencyKey: 'invitation:one',
    });

    expect(reads).toEqual(['public:identity:public']);
    expect(writes).toEqual(['mall-zhudatuan', 'mall-zhudatuan']);
  });

  it('routes an optional anonymous storefront read into its server-resolved mall scope', async () => {
    const scopes: string[] = [];
    const transactions: TransactionManager = {
      read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => {
        scopes.push(options.scope);
        return work(context('read', options)) as Promise<T>;
      },
      write: async () => {
        throw new Error('WRITE_NOT_EXPECTED');
      },
    };
    const executor = new OperationExecutor(
      transactions,
      { claim: async () => ({ state: 'started' }), checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const reply = { status: 200, body: { items: [], categories: [], nextCursor: null, version: '1', asOf: '2026-09-01T00:00:00.000Z' } as OperationOutputFor<'storefront.catalog.read'> };
    const handler = {
      operation: 'storefront.catalog.read' as const,
      mode: 'read' as const,
      load: async () => Object.freeze({ mall: 'mall-zhudatuan' }),
      prepare: async (_input: unknown, _context: unknown, loaded: Readonly<{ mall: string }>) => loaded,
      transactionScope: (_input: unknown, prepared: Readonly<{ mall: string }>) => prepared.mall,
      commit: async () => ({ checkpoint: reply, response: reply }),
      finalize: async () => reply,
    };

    await executor.execute(handler, {} as OperationInputFor<'storefront.catalog.read'>, {
      requestId: 'request:catalog',
      traceId: 'trace:catalog',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'storefront.catalog.read',
      headers: { 'x-storefront-handle': 'zhudatuan-local' },
      rawBody: '',
      security: { kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:catalog' },
      publicActor: 'anonymous:storefront',
    });

    expect(scopes).toEqual(['public:navigation:public', 'mall-zhudatuan']);
  });

  it('routes a prepared preauth completion into its server-resolved scope', async () => {
    const scopes: string[] = [];
    const transactions: TransactionManager = {
      read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => work(context('read', options)) as Promise<T>,
      write: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['write']>[1]) => {
        scopes.push(options.scope);
        return work(context('write', options)) as Promise<T>;
      },
    };
    const executor = new OperationExecutor(
      transactions,
      { claim: async () => ({ state: 'started' }), checkpoint: async () => undefined, complete: async () => undefined },
      { verify: async () => undefined },
      new AuditDecorator({ append: async () => undefined }),
      { append: async () => undefined }
    );
    const handler = {
      operation: 'identity.sessions.complete' as const,
      mode: 'write' as const,
      load: async () => Object.freeze({ scope: 'mall-zhudatuan' }),
      prepare: async (_input: unknown, _context: unknown, loaded: Readonly<{ scope: string }>) => loaded,
      transactionScope: (_input: unknown, prepared: Readonly<{ scope: string }>) => prepared.scope,
      commit: async () => ({ checkpoint: {}, response: { status: 201, body: {} as OperationOutputFor<'identity.sessions.complete'> } }),
      finalize: async () => ({ status: 201, body: {} as OperationOutputFor<'identity.sessions.complete'> }),
    };

    await executor.execute(handler, {} as OperationInputFor<'identity.sessions.complete'>, {
      requestId: 'request:proof',
      traceId: 'trace:proof',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'identity.sessions.complete',
      headers: {},
      rawBody: '',
      security: {
        kind: 'preauth',
        id: 'preauth:one',
        purpose: 'invitationproof',
        target: 'storefront',
        principal: 'principal:one',
        reference: 'claim:one',
        version: 1,
        expires: new Date(Date.now() + 60_000),
        trace: 'trace:proof',
        authorization: null,
        returnTarget: null,
      },
      publicActor: 'public:proof',
      idempotencyKey: 'proof:one',
    });

    expect(scopes).toEqual(['mall-zhudatuan', 'mall-zhudatuan']);
  });

  it('allows a GET callback to load read-only, call its provider outside a transaction and commit with write semantics', async () => {
    const order: string[] = [];
    let transactionOpen = false;
    const transactions: TransactionManager = {
      read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => {
        order.push('load.read');
        transactionOpen = true;
        try {
          return (await work(context('read', options))) as T;
        } finally {
          transactionOpen = false;
        }
      },
      write: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['write']>[1]) => {
        order.push('commit.write');
        transactionOpen = true;
        try {
          return (await work(context('write', options))) as T;
        } finally {
          transactionOpen = false;
        }
      },
    };
    const executor = new OperationExecutor(transactions, { claim: vi.fn(), checkpoint: async () => undefined, complete: async () => undefined }, { verify: async () => undefined }, new AuditDecorator({ append: async () => undefined }), {
      append: async () => undefined,
    });
    const handler = {
      operation: 'identity.federations.callback' as const,
      mode: 'write' as const,
      load: async () => {
        order.push('load');
        return Object.freeze({ transaction: 'federation:one' });
      },
      prepare: async () => {
        expect(transactionOpen).toBe(false);
        order.push('provider.callback');
        return Object.freeze({ subject: 'subject:one' });
      },
      commit: async () => {
        expect(transactionOpen).toBe(true);
        order.push('commit');
        return { checkpoint: {}, response: { status: 303, body: {} as OperationOutputFor<'identity.federations.callback'> } };
      },
      finalize: async () => ({ status: 303, body: {} as OperationOutputFor<'identity.federations.callback'> }),
    };

    await executor.execute(handler, {} as OperationInputFor<'identity.federations.callback'>, {
      requestId: 'request:callback',
      traceId: 'trace:callback',
      deadline: Date.now() + 10_000,
      signal: new AbortController().signal,
      operation: 'identity.federations.callback',
      headers: {},
      rawBody: '',
      security: { kind: 'anonymous', channel: 'public', target: 'console', trace: 'trace:callback' },
      publicActor: 'public:federation',
    });

    expect(order).toEqual(['load.read', 'load', 'provider.callback', 'commit.write', 'commit']);
  });
});

function fakeTransactions(order: string[]): TransactionManager {
  return {
    read: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['read']>[1]) => {
      order.push('transaction.read');
      return work(context('read', options)) as Promise<T>;
    },
    write: async <T>(options: TransactionOptions, work: Parameters<TransactionManager['write']>[1]) => {
      order.push('transaction.write');
      return work(context('write', options)) as Promise<T>;
    },
  };
}

function context<TMode extends 'read' | 'write'>(mode: TMode, options: TransactionOptions) {
  return Object.freeze({ mode, id: `transaction:${mode}`, ...options }) as unknown as TransactionContext<TMode>;
}

function execution<TKey extends 'observability.clienterrors.create'>(operation: TKey) {
  return {
    requestId: 'request:1',
    traceId: 'trace:1',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
    operation,
    headers: {},
    rawBody: '',
    security: { kind: 'anonymous', channel: 'public', target: null, trace: 'trace:1' } as const,
    publicActor: `public:${'a'.repeat(64)}`,
    idempotencyKey: 'idem:1',
  };
}
