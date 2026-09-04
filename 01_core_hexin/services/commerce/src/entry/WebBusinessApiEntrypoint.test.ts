import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import type { OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { WebBusinessRuntimeModule } from '../modules/runtime/WebBusinessRuntimeModule';
import { WEB_BUSINESS_RUNTIME_OPERATION_IDS } from '../modules/runtime/WebBusinessRuntimeOperations';
import { WEB_BUSINESS_MODULES } from '../modules/webbusiness/WebBusinessModules';
import { WEB_BUSINESS_OPERATION_IDS } from '../modules/webbusiness/WebBusinessOperationIds';

const APPROVED_BUSINESS_OPERATIONS = [
  'organization.layers.read',
  'member.profile.read',
  'member.addresses.read',
  'member.addresses.manage',
  'catalog.listings.read',
  'pricing.offers.read',
  'inventory.availability.read',
  'reporting.dashboard.read',
  'cart.current.read',
  'cart.items.put',
  'cart.items.batch',
  'order.orders.read',
  'benefit.accounts.read',
  'benefit.ledgers.read',
] as const satisfies readonly OperationId[];

describe('web business API entrypoint', () => {
  it('contains only health and the explicitly approved Console/Storefront operation set', () => {
    expect(WEB_BUSINESS_OPERATION_IDS).toEqual(APPROVED_BUSINESS_OPERATIONS);
    expect([...WEB_BUSINESS_RUNTIME_OPERATION_IDS, ...WEB_BUSINESS_OPERATION_IDS]).toEqual([
      'runtime.health.live',
      'runtime.health.ready',
      'runtime.health.startup',
      ...APPROVED_BUSINESS_OPERATIONS,
    ]);
    expect(WEB_BUSINESS_OPERATION_IDS).not.toContain('checkout.quote.create');
    expect(WEB_BUSINESS_OPERATION_IDS).not.toContain('order.orders.create');
    expect(WEB_BUSINESS_OPERATION_IDS).not.toContain('payment.intents.create');
  });

  it('freezes exact routes and has no checkout, order-create, or payment route', async () => {
    const operationIds = [...WEB_BUSINESS_RUNTIME_OPERATION_IDS, ...WEB_BUSINESS_OPERATION_IDS];
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const extensions = new ExtensionRegistry({ verify: async () => false });
    const bootstrapped = await bootstrapApi({
      modules: [WebBusinessRuntimeModule, ...WEB_BUSINESS_MODULES],
      operationIds,
      extensions,
      allowedOrigins: ['https://console.zhudatuan.com', 'https://zhudatuan.com'],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(KMS_CLIENT, new KmsClient('https://kms.internal', 'k'.repeat(43)));
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(bootstrapped.routes.match('GET', '/api/v1/members/me')?.operation).toBe('member.profile.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/catalog/listings')?.operation).toBe('catalog.listings.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/orders')?.operation).toBe('order.orders.read');
    expect(bootstrapped.routes.match('POST', '/api/v1/orders')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/checkouts/quotes')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/payments/intents')).toBeNull();
  });

  it('has no static dependency path to full Commerce, checkout orchestration, payment, finance, providers, storage, or Redis', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'WebBusinessApiMain.ts'));
    const forbidden = [...closure].filter((file) => [
      '/bootstrap/CommerceRuntime.ts',
      '/bootstrap/ProviderLoader.ts',
      '/app/modules.ts',
      '/modules/order_dingdan/03_application_yingyong/services_fuwu/OrderOperations.ts',
      '/modules/member/03_application_yingyong/MemberOperations.ts',
      '/modules/benefit/BenefitOperations.ts',
      '/modules/reporting/ReportingModule.ts',
      '/modules/checkout_jiesuan/05_interface_jieru/CheckoutModule.ts',
      '/modules/payment_zhifu/',
      '/modules/finance/',
      '/foundation/infrastructure/ObjectStore.ts',
      '/foundation/cache/',
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
      const candidate = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base].find(existsSync);
      if (candidate) visit(candidate);
    }
  };
  visit(entry);
  return visited;
}
