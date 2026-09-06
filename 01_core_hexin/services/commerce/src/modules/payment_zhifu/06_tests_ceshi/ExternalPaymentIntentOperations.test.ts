import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { AuditSink } from '../../../foundation/application/AuditSink';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { PaymentGateway } from '../01_public_gongkai/ports_jiekou/PaymentGateway';
import type { PaymentIntentContextReader, PaymentIntentState, PaymentRecoveryQueue } from '../01_public_gongkai/contracts_qiyue/PaymentContractModule';
import { ExternalPaymentIntentOperations } from '../03_application_yingyong/services_fuwu/ExternalPaymentIntentOperations';

describe('external payment intent operation', () => {
  it('returns reconciling and actively enqueues a query when WeChat prepay times out', async () => {
    const fixture = operationFixture({ prepayFailure: new Error('WECHAT_TIMEOUT') });

    await expect(fixture.operation.invoke(request())).resolves.toEqual({
      status: 202,
      body: { intent: 'intent:one', state: 'reconciling' },
    });
    expect(fixture.recovery.enqueue).toHaveBeenCalledOnce();
    expect(fixture.recovery.enqueue).toHaveBeenCalledWith(expect.anything(), {
      membership: 'membership:one', session: 'session:one', mall: 'mall:one', intent: 'intent:one',
      priority: 1, delaySeconds: 0,
    });
    expect(fixture.commands.some((sql) => sql.includes("set state='unknown'"))).toBe(true);
    expect(fixture.commands.some((sql) => sql.includes("set state='failed'"))).toBe(false);
  });

  it('records a definite provider rejection without enqueueing an uncertain-outcome query', async () => {
    const fixture = operationFixture({ prepayFailure: new Error('WECHAT_PREPAY_REJECTED') });

    await expect(fixture.operation.invoke(request())).rejects.toThrow('WECHAT_PREPAY_REJECTED');
    expect(fixture.recovery.enqueue).not.toHaveBeenCalled();
    expect(fixture.commands.some((sql) => sql.includes("set state='failed'"))).toBe(true);
    expect(fixture.commands.some((sql) => sql.includes("set state='unknown'"))).toBe(false);
  });

  it('treats a local write failure after provider acceptance as unknown and schedules reconciliation', async () => {
    const fixture = operationFixture({ persistenceFailure: new Error('DATABASE_WRITE_FAILED') });

    await expect(fixture.operation.invoke(request())).resolves.toEqual({
      status: 202,
      body: { intent: 'intent:one', state: 'reconciling' },
    });
    expect(fixture.gateway.prepay).toHaveBeenCalledOnce();
    expect(fixture.gateway.prepay).toHaveBeenCalledWith(expect.objectContaining({ scope: 'mall:one' }));
    expect(fixture.recovery.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      intent: 'intent:one', priority: 1, delaySeconds: 0,
    }));
    expect(fixture.commands.some((sql) => sql.includes("set state='unknown'"))).toBe(true);
    expect(fixture.commands.some((sql) => sql.includes("set state='failed'"))).toBe(false);
  });

  it('repairs the recovery job when an existing provider attempt is still active', async () => {
    const fixture = operationFixture({ state: {
      attempt: 'attempt:one', state: 'started', scene: 'jsapi', application_hash: 'a'.repeat(64),
    } });

    await expect(fixture.operation.invoke(request())).resolves.toEqual({
      status: 202,
      body: { intent: 'intent:one', state: 'authorizing' },
    });
    expect(fixture.gateway.prepay).not.toHaveBeenCalled();
    expect(fixture.recovery.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      intent: 'intent:one', priority: 10, delaySeconds: 5,
    }));
  });

  it('does not query WeChat when a timeout happens before the provider call starts', async () => {
    const fixture = operationFixture({ kmsFailure: new Error('KMS_TIMEOUT') });

    await expect(fixture.operation.invoke(request())).rejects.toThrow('KMS_TIMEOUT');
    expect(fixture.gateway.prepay).not.toHaveBeenCalled();
    expect(fixture.recovery.enqueue).not.toHaveBeenCalled();
    expect(fixture.commands.some((sql) => sql.includes("set state='failed'"))).toBe(true);
  });
});

interface FixtureOptions {
  readonly prepayFailure?: Error;
  readonly persistenceFailure?: Error;
  readonly kmsFailure?: Error;
  readonly state?: Partial<PaymentIntentState>;
}

function operationFixture(options: FixtureOptions = {}) {
  let idempotency: { request_hash: string; state: string; response: null } | undefined;
  let persistenceFailed = false;
  const commands: string[] = [];
  const client = {
    query: async (sql: string, values: readonly unknown[] = []) => {
      commands.push(sql);
      if (options.persistenceFailure && !persistenceFailed && sql.includes('with saved as')) {
        persistenceFailed = true;
        throw options.persistenceFailure;
      }
      if (sql.includes('insert into runtime.idempotency') && idempotency === undefined) {
        idempotency = { request_hash: String(values[3]), state: 'started', response: null };
      }
      if (sql.startsWith('select request_hash,state,response')) return result(idempotency ? [idempotency] : []);
      if (sql.includes('update ordering.orderrecord')) return result([{ id: 'order:one' }]);
      return result([]);
    },
    release: () => undefined,
  } as unknown as PoolClient;
  const pool: DatabasePool = {
    connect: async () => client,
    query: async () => result([]),
    workload: () => pool,
    end: async () => undefined,
  };
  const gateway: PaymentGateway = {
    application: (scene: Parameters<PaymentGateway['application']>[0]) => ({ scene, applicationHash: 'a'.repeat(64) }),
    prepay: vi.fn(async () => {
      if (options.prepayFailure) throw options.prepayFailure;
      return { appId: 'wx-one', timeStamp: '1788336000', nonceStr: 'nonce', package: 'prepay_id=one', signType: 'RSA',
        paySign: 'signed', providerRequestId: 'provider:one' };
    }),
    query: vi.fn(), close: vi.fn(), refund: vi.fn(), queryRefund: vi.fn(), verifyNotification: vi.fn(),
  } as unknown as PaymentGateway;
  const contexts: PaymentIntentContextReader = { read: vi.fn(async () => ({ ...intent(), ...options.state })) };
  const recovery: PaymentRecoveryQueue & { enqueue: ReturnType<typeof vi.fn> } = { enqueue: vi.fn(async () => undefined) };
  const kms = { decrypt: vi.fn(async () => {
    if (options.kmsFailure) throw options.kmsFailure;
    return 'openid:one';
  }) } as unknown as KmsClient;
  const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
  return {
    commands,
    gateway,
    recovery,
    operation: new ExternalPaymentIntentOperations(pool, gateway, kms, audit, contexts, recovery),
  };
}

function intent(): PaymentIntentState {
  return {
    intent: 'intent:one', attempt: null, order_id: 'order:one', order_number: 'SW20260902000000000001',
    scope_id: 'mall:one', mall_id: 'mall:one', member_id: 'member:one', total_minor: 5180, amount_minor: 5180,
    payer_identity: 'identity:one', payer_ciphertext: 'ciphertext:openid:one', state: null, parameters: null,
    scene: null, application_hash: null, expires_at: '2026-09-02T08:00:00Z',
  };
}

function request(): OperationRequest {
  return {
    type: 'payment.intents.create',
    access: {
      actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1,
        accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'member:one', kind: 'owner', tenant: 'mall:one', path: [] },
      mallContext: { mall_id: 'mall:one' }, mall_id: 'mall:one', accessVersion: 1,
      capabilities: ['payment.intents.create'], assurance: { level: 2 }, trace: 'trace:one',
    },
    input: {
      path: {}, query: {}, headers: {}, body: { order: 'order:one', scene: 'jsapi' }, rawBody: '{}',
      deadline: Date.now() + 10_000, signal: new AbortController().signal, idempotency: 'payment:one',
    },
  };
}

function result(rows: readonly object[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
