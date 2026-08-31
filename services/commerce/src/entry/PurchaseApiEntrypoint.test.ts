import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import type { OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { DECISION_SINK } from '../foundation/security/DecisionSink';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { PAYMENT_GATEWAY } from '../modules/payment/application/port/PaymentGateway';
import { DisabledExternalPaymentGateway } from '../modules/purchase/DisabledExternalPaymentGateway';
import { PURCHASE_MODULES } from '../modules/purchase/PurchaseModules';
import { PURCHASE_OPERATION_IDS, PURCHASE_QUOTE_KEY } from '../modules/purchase/PurchaseOperations';
import { PurchaseRuntimeModule } from '../modules/runtime/PurchaseRuntimeModule';
import { PURCHASE_RUNTIME_OPERATION_IDS } from '../modules/runtime/PurchaseRuntimeOperations';

const APPROVED_PURCHASE_OPERATIONS = [
  'checkout.quote.create',
  'order.orders.create',
  'payment.intents.create',
] as const satisfies readonly OperationId[];

describe('purchase API entrypoint', () => {
  it('contains only health and the three purchase commands', () => {
    expect(PURCHASE_OPERATION_IDS).toEqual(APPROVED_PURCHASE_OPERATIONS);
    expect([...PURCHASE_RUNTIME_OPERATION_IDS, ...PURCHASE_OPERATION_IDS]).toEqual([
      'runtime.health.live', 'runtime.health.ready', 'runtime.health.startup', ...APPROVED_PURCHASE_OPERATIONS,
    ]);
  });

  it('freezes exact routes with no read, refund, webhook, recovery, or admin surface', async () => {
    const operationIds = [...PURCHASE_RUNTIME_OPERATION_IDS, ...PURCHASE_OPERATION_IDS];
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const bootstrapped = await bootstrapApi({
      modules: [PurchaseRuntimeModule, ...PURCHASE_MODULES],
      operationIds,
      extensions: new ExtensionRegistry({ verify: async () => false }),
      allowedOrigins: ['https://zhudatuan.com'],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(DECISION_SINK, { append: async () => undefined });
        container.bind(RISK_GATE, { evaluate: async () => ({ outcome: 'allow', safeReason: 'policy', decision: null }) });
        container.bind(PURCHASE_QUOTE_KEY, 'q'.repeat(43));
        container.bind(PAYMENT_GATEWAY, new DisabledExternalPaymentGateway());
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(bootstrapped.routes.match('POST', '/api/v1/checkouts/quotes')?.operation).toBe('checkout.quote.create');
    expect(bootstrapped.routes.match('POST', '/api/v1/orders')?.operation).toBe('order.orders.create');
    expect(bootstrapped.routes.match('POST', '/api/v1/payments/intents')?.operation).toBe('payment.intents.create');
    for (const [method, path] of [
      ['GET', '/api/v1/orders'],
      ['POST', '/api/v1/payments/refunds'],
      ['POST', '/api/v1/payments/webhooks/wechat'],
      ['GET', '/api/v1/payments/recoveries'],
      ['POST', '/api/v1/finance/settlements'],
    ]) expect(bootstrapped.routes.match(method!, path!)).toBeNull();
  });

  it('has no static dependency on full runtime, provider gateways, or payment administration', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'PurchaseApiMain.ts'));
    const forbidden = [...closure].filter((file) => [
      '/bootstrap/CommerceRuntime.ts', '/bootstrap/ProviderLoader.ts', '/app/modules.ts',
      '/modules/payment/PaymentModule.ts', '/modules/payment/PaymentOperations.ts', '/modules/payment/PaymentJobs.ts',
      '/modules/payment/PaymentWebhook.ts', '/modules/payment/PaymentOperationSupport.ts',
      '/modules/payment/application/RefundPlanner.ts', '/modules/payment/application/RefundSettlement.ts',
      '/modules/payment/infrastructure/', '/modules/finance/',
      '/bootstrap/ProviderFactories.ts', '/foundation/infrastructure/ObjectStore.ts', '/foundation/cache/',
    ].some((candidate) => file.includes(candidate)));
    expect(forbidden).toEqual([]);
  });
});

function sourceClosure(entry: string): ReadonlySet<string> {
  const visited = new Set<string>();
  const visit = (file: string): void => {
    const normalized = normalize(file);
    if (visited.has(normalized)) return;
    visited.add(normalized);
    const source = readFileSync(normalized, 'utf8');
    for (const match of source.matchAll(/(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) {
      const base = join(dirname(normalized), match[2]!);
      const candidate = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')].find(existsSync);
      if (candidate) visit(candidate);
    }
  };
  visit(entry);
  return visited;
}
