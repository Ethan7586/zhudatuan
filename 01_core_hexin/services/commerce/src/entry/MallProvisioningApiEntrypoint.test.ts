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
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { MallProvisioningModule } from '../modules/provisioning/MallProvisioningModule';
import { MALL_PROVISIONING_OPERATION_IDS } from '../modules/provisioning/ProvisioningOperations';
import { MallProvisioningRuntimeModule } from '../modules/runtime/MallProvisioningRuntimeModule';
import { MALL_PROVISIONING_RUNTIME_OPERATION_IDS } from '../modules/runtime/MallProvisioningRuntimeOperations';

const APPROVED_MALL_PROVISIONING_OPERATIONS = [
  'provisioning.malls.create',
  'provisioning.malls.read',
] as const satisfies readonly OperationId[];

describe('mall provisioning API entrypoint', () => {
  it('contains only health, mall creation, and provisioning readiness read', () => {
    expect(MALL_PROVISIONING_OPERATION_IDS).toEqual(APPROVED_MALL_PROVISIONING_OPERATIONS);
    expect([...MALL_PROVISIONING_RUNTIME_OPERATION_IDS, ...MALL_PROVISIONING_OPERATION_IDS]).toEqual([
      'runtime.health.live',
      'runtime.health.ready',
      'runtime.health.startup',
      ...APPROVED_MALL_PROVISIONING_OPERATIONS,
    ]);
  });

  it('exposes exactly the provisioning create/read routes and no unrelated mutation surface', async () => {
    const operationIds = [...MALL_PROVISIONING_RUNTIME_OPERATION_IDS, ...MALL_PROVISIONING_OPERATION_IDS];
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const bootstrapped = await bootstrapApi({
      modules: [MallProvisioningRuntimeModule, MallProvisioningModule],
      operationIds,
      extensions: new ExtensionRegistry({ verify: async () => false }),
      allowedOrigins: ['https://console.zhudatuan.com'],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(bootstrapped.routes.match('POST', '/api/v1/provisioning/malls')?.operation)
      .toBe('provisioning.malls.create');
    expect(bootstrapped.routes.match('GET', '/api/v1/provisioning/malls/mall:one')?.operation)
      .toBe('provisioning.malls.read');
    for (const [method, path] of [
      ['GET', '/api/v1/provisioning/malls'],
      ['PATCH', '/api/v1/provisioning/malls/mall:one'],
      ['POST', '/api/v1/orders'],
      ['POST', '/api/v1/payments/intents'],
      ['POST', '/api/v1/finance/settlements'],
    ]) expect(bootstrapped.routes.match(method!, path!)).toBeNull();
  });

  it('depends only on the three mall creation ports and no full business module or provider runtime', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'MallProvisioningApiMain.ts'));
    const requiredPorts = [
      '/modules/catalog/01_public_gongkai/CatalogProvisioningPort.ts',
      '/modules/experience/ExperienceProvisioningPort.ts',
      '/modules/organization/MallOrganizationProvisioningPort.ts',
      '/modules/provisioning/MallOwnerProvisioningPort.ts',
    ];
    for (const port of requiredPorts) expect([...closure].some((file) => file.endsWith(port))).toBe(true);
    const forbidden = [...closure].filter((file) => [
      '/bootstrap/CommerceRuntime.ts',
      '/bootstrap/ProviderLoader.ts',
      '/bootstrap/ProviderFactories.ts',
      '/app/modules.ts',
      '/modules/organization/OrganizationPort.ts',
      '/modules/order_dingdan/',
      '/modules/checkout_jiesuan/',
      '/modules/inventory/',
      '/modules/payment_zhifu/',
      '/modules/finance/',
      '/modules/member/',
      '/modules/referral/',
      '/modules/hierarchy/',
      '/foundation/infrastructure/KmsClient.ts',
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
