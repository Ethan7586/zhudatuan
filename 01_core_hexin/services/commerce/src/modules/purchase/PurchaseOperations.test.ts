import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../bootstrap/Container';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import type { AuditSink } from '../../foundation/application/AuditSink';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { KMS_CLIENT, type KmsClient } from '../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL, type DatabasePool } from '../../foundation/persistence/Pool';
import { DECISION_SINK, type DecisionSink } from '../../foundation/security/DecisionSink';
import { RISK_GATE, type RiskGate } from '../../foundation/security/RiskGate';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payment_zhifu';
import { purchaseOrderResponse, purchasePaymentAction, purchasePaymentOperations } from './PurchaseOperations';

describe('purchase-only payment operation', () => {
  it('captures an internal intent with zero provider method calls', async () => {
    const gateway = fakeGateway();
    const capture = vi.fn(async () => 'payment:one');
    const risk = fakeRisk();
    const decisions = fakeDecisions();
    const action = purchasePaymentAction(gateway, risk, decisions, () => ({ capture }));
    const database = { query: vi.fn(async () => result([intent()])) } as unknown as OperationDatabase;

    await expect(action(request(2), database)).resolves.toEqual({
      status: 200,
      body: { intent: 'intent:one', payment: 'payment:one', state: 'captured' },
    });
    expect(capture).toHaveBeenCalledOnce();
    expect(risk.evaluate).toHaveBeenCalledWith(expect.objectContaining({ operation: 'payment.intents.create', resource: 'order:one', amountMinor: 100 }));
    expect(decisions.append).toHaveBeenCalledWith(expect.objectContaining({ operation: 'payment.intents.create', resource: 'order:one',
      outcome: 'allow', reason: 'AMOUNT_RISK_ALLOW_AMOUNT' }));
    expect(gateway.application).toHaveBeenCalledOnce();
    assertNoProviderCalls(gateway);
  });

  it('rejects AAL1, cross-member absence, and external tenders before settlement', async () => {
    const gateway = fakeGateway();
    const capture = vi.fn(async () => 'payment:one');
    const risk = fakeRisk();
    const action = purchasePaymentAction(gateway, risk, fakeDecisions(), () => ({ capture }));
    const noScope = { query: vi.fn(async () => result([])) } as unknown as OperationDatabase;
    await expect(action(request(1), noScope)).rejects.toThrow('MOBILE_ASSURANCE_REQUIRED');
    expect(noScope.query).not.toHaveBeenCalled();
    await expect(action(request(2), noScope)).rejects.toThrow('PAYMENT_INTENT_CARDINALITY_INVALID');
    const external = { query: vi.fn(async () => result([{ ...intent(), unsupported_tenders: 1 }])) } as unknown as OperationDatabase;
    await expect(action(request(2), external)).rejects.toThrow('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
    expect(capture).not.toHaveBeenCalled();
    expect(gateway.application).not.toHaveBeenCalled();
    expect(risk.evaluate).not.toHaveBeenCalled();
    assertNoProviderCalls(gateway);
  });

  it('fails closed when more than one payable intent exists for an order', async () => {
    const gateway = fakeGateway();
    const capture = vi.fn(async () => 'payment:one');
    const risk = fakeRisk();
    const action = purchasePaymentAction(gateway, risk, fakeDecisions(), () => ({ capture }));
    const database = { query: vi.fn(async () => result([intent(), { ...intent(), intent: 'intent:two' }])) } as unknown as OperationDatabase;

    await expect(action(request(2), database)).rejects.toThrow('PAYMENT_INTENT_CARDINALITY_INVALID');
    expect(capture).not.toHaveBeenCalled();
    expect(gateway.application).not.toHaveBeenCalled();
    assertNoProviderCalls(gateway);
  });

  it('rejects a Console session before database access and an amount-risk challenge before capture', async () => {
    const gateway = fakeGateway();
    const capture = vi.fn(async () => 'payment:one');
    const risk = fakeRisk('challenge');
    const decisions = fakeDecisions();
    const action = purchasePaymentAction(gateway, risk, decisions, () => ({ capture }));
    const database = { query: vi.fn(async () => result([intent()])) } as unknown as OperationDatabase;

    await expect(action(request(2, 'console'), database)).rejects.toThrow('PURCHASE_AUDIENCE_TARGET_MISMATCH');
    expect(database.query).not.toHaveBeenCalled();
    await expect(action(request(2), database)).rejects.toThrow('STEPUP_REQUIRED');
    expect(risk.evaluate).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 100 }));
    expect(decisions.append).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'challenge',
      reason: 'AMOUNT_RISK_CHALLENGE_AMOUNT' }));
    expect(capture).not.toHaveBeenCalled();
    expect(gateway.application).not.toHaveBeenCalled();
    assertNoProviderCalls(gateway);
  });

  it('replays the completed response once and rolls back a rejected external intent', async () => {
    let stored: { request_hash: string; state: string; response: unknown } | undefined;
    let external = false;
    const commands: string[] = [];
    const client = {
      query: async (text: string, values: readonly unknown[] = []) => {
        if (text.startsWith('begin')) commands.push('begin');
        if (text === 'commit') commands.push('commit');
        if (text === 'rollback') commands.push('rollback');
        if (text.includes('insert into runtime.idempotency') && stored === undefined) {
          stored = { request_hash: String(values[3]), state: 'started', response: null };
        }
        if (text.startsWith('select request_hash,state,response')) return result(stored ? [stored] : []);
        if (text.includes('access.purchase_payment_intent_context')) return result([{
          intent: 'intent:one', attempt: null, order_id: 'order:one', order_number: 'SW20260828000000000001',
          scope_id: 'mall:one', mall_id: 'mall:one', member_id: 'member:one', total_minor: 100, amount_minor: 0,
          payer_identity: null, payer_ciphertext: null, state: null, parameters: null, scene: null,
          application_hash: null, expires_at: '2026-09-02T08:00:00Z',
        }]);
        if (text.includes('select intent.id intent')) return result([{ ...intent(), unsupported_tenders: external ? 1 : 0 }]);
        if (text.includes("update runtime.idempotency set state='completed'")) {
          stored = { request_hash: stored!.request_hash, state: 'completed', response: JSON.parse(String(values[3])) };
        }
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
    const gateway = fakeGateway();
    const capture = vi.fn(async () => 'payment:one');
    const operations = purchasePaymentOperations(context(pool, gateway, fakeRisk()), () => ({ capture }));
    const internal = request(2);
    await expect(operations.invoke(internal)).resolves.toMatchObject({ status: 200, body: { state: 'captured' } });
    await expect(operations.invoke(internal)).resolves.toMatchObject({ status: 200, body: { state: 'captured' } });
    expect(capture).toHaveBeenCalledOnce();

    stored = undefined;
    external = true;
    await expect(operations.invoke({ ...internal, input: { ...internal.input, idempotency: 'external-key' } }))
      .rejects.toThrow('PAYMENT_EXTERNAL_TENDER_FORBIDDEN');
    expect(commands.at(-1)).toBe('rollback');
    expect(commands.filter((command) => command === 'commit')).toHaveLength(2);
    assertNoProviderCalls(gateway);
  });
});

describe('purchase-only order response', () => {
  it('returns only the storefront allowlist and never address, invoice, evidence, or tender internals', () => {
    const response = purchaseOrderResponse({
      status: 201,
      body: {
        id: 'order:one', order_number: 'SW20260828000000000001', payment_state: 'unpaid', fulfillment_state: 'unallocated',
        aftersale_state: 'none', lifecycle_state: 'created', version: '0', address_snapshot: { recipient_ciphertext: 'secret' },
        invoice_snapshot: { taxid_ciphertext: 'secret' }, evidence: { tenders: [{ account: 'benefit:one' }] },
        dependencies: { private: true }, tenders: [{ kind: 'benefit' }],
        payment: { intent: 'intent:one', personalMinor: 0, action: 'payment.intents.create', provider: 'private' },
      },
      headers: { etag: '"0"' },
    });

    expect(response).toEqual({
      status: 201,
      body: {
        id: 'order:one', orderNumber: 'SW20260828000000000001', paymentState: 'unpaid', fulfillmentState: 'unallocated',
        aftersaleState: 'none', lifecycleState: 'created', version: 0,
        payment: { intent: 'intent:one', personalMinor: 0, action: 'payment.intents.create' },
      },
      headers: { etag: '"0"' },
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('ciphertext');
    expect(serialized).not.toContain('evidence');
    expect(serialized).not.toContain('tenders');
    expect(serialized).not.toContain('provider');
  });
});

function context(pool: DatabasePool, gateway: PaymentGateway, risk: RiskGate): ModuleContext {
  const container = new Container();
  const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, audit);
  container.bind(PAYMENT_GATEWAY, gateway);
  container.bind(KMS_CLIENT, { decrypt: async () => 'openid:one' } as unknown as KmsClient);
  container.bind(RISK_GATE, risk);
  container.bind(DECISION_SINK, fakeDecisions());
  return { container } as unknown as ModuleContext;
}

function request(level: number, target: 'console' | 'storefront' | 'store' | 'supplier' = 'storefront'): OperationRequest {
  return {
    type: 'payment.intents.create',
    access: {
      actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1,
        accessVersion: 1, target, assurance: { level } },
      membership: { id: 'membership:one', active: true, accessVersion: 1, denies: [], grants: [] },
      scope: { id: 'member:one', kind: 'owner', tenant: 'mall:one', path: [] },
      mall_id: 'mall:one', mallContext: { mall_id: 'mall:one' },
      accessVersion: 1, capabilities: ['payment.intents.create'], assurance: { level }, trace: 'trace:one',
    },
    input: { path: {}, query: {}, headers: {}, body: { order: 'order:one', scene: 'jsapi' }, rawBody: '{}',
      deadline: Date.now() + 10_000, signal: new AbortController().signal, idempotency: 'payment-key' },
  } as OperationRequest;
}

function intent() {
  return { intent: 'intent:one', order_id: 'order:one', scope_id: 'mall:one', mall_id: 'mall:one', member_id: 'member:one',
    currency: 'CNY', amount_minor: 100, state: 'created', tender_count: 1, tender_total: 100, unsupported_tenders: 0 };
}

function fakeGateway(): PaymentGateway & Record<'prepay' | 'query' | 'close' | 'refund' | 'queryRefund' | 'verifyNotification', ReturnType<typeof vi.fn>> {
  return {
    application: vi.fn((scene) => ({ scene, applicationHash: 'a'.repeat(64) })),
    prepay: vi.fn(), query: vi.fn(), close: vi.fn(), refund: vi.fn(), queryRefund: vi.fn(), verifyNotification: vi.fn(),
  } as unknown as ReturnType<typeof fakeGateway>;
}

function fakeRisk(outcome: 'allow' | 'challenge' | 'review' | 'deny' = 'allow'): RiskGate & { evaluate: ReturnType<typeof vi.fn> } {
  return { evaluate: vi.fn(async () => ({ outcome, safeReason: 'amount' as const, decision: null })) };
}

function fakeDecisions(): DecisionSink & { append: ReturnType<typeof vi.fn> } {
  return { append: vi.fn(async () => undefined) };
}

function assertNoProviderCalls(gateway: ReturnType<typeof fakeGateway>): void {
  expect(gateway.prepay).not.toHaveBeenCalled();
  expect(gateway.query).not.toHaveBeenCalled();
  expect(gateway.close).not.toHaveBeenCalled();
  expect(gateway.refund).not.toHaveBeenCalled();
  expect(gateway.queryRefund).not.toHaveBeenCalled();
  expect(gateway.verifyNotification).not.toHaveBeenCalled();
}

function result(rows: object[]): QueryResult {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] } as unknown as QueryResult;
}
