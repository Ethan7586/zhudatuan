import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import type { OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { IDENTITY_SECURITY_KEYS } from '../foundation/infrastructure/SecretStore';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { IDENTITY_REGISTRATION_OPERATION_IDS } from '../modules/identity/IdentityOperations';
import { IdentityRegistrationModule } from '../modules/identity/IdentityRegistrationModule';
import { RETURN_TARGETS } from '../modules/identity/infrastructure/ReturnTargetCatalog';
import { IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS } from '../modules/runtime/IdentityRegistrationRuntimeOperations';
import { IdentityRegistrationRuntimeModule } from '../modules/runtime/IdentityRegistrationRuntimeModule';

describe('identity registration API entrypoint', () => {
  it('exposes only health, login, logout, invitation, OTP, and registration operations', () => {
    expect([...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS, ...IDENTITY_REGISTRATION_OPERATION_IDS]).toEqual([
      'runtime.health.live',
      'runtime.health.ready',
      'runtime.health.startup',
      'identity.sessions.create',
      'identity.tickets.exchange',
      'identity.session.read',
      'identity.session.delete',
      'identity.challenges.create',
      'identity.invitations.read',
      'identity.invitations.create',
      'identity.invitations.revoke',
      'identity.members.create',
    ]);
  });

  it('freezes a route registry containing only the approved operation set', async () => {
    const operationIds = [...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS, ...IDENTITY_REGISTRATION_OPERATION_IDS];
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const extensions = new ExtensionRegistry({ verify: async () => false });
    const bootstrapped = await bootstrapApi({
      modules: [IdentityRegistrationRuntimeModule, IdentityRegistrationModule],
      operationIds,
      extensions,
      allowedOrigins: ['https://accounts.zhudatuan.com'],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(RISK_GATE, {} as never);
        container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-test-key', session: 'session-test-key' });
        container.bind(KMS_CLIENT, new KmsClient('https://kms.internal', 'k'.repeat(43)));
        container.bind(RETURN_TARGETS, {
          console: 'https://console.zhudatuan.com', storefront: 'https://zhudatuan.com',
          store: 'https://console.zhudatuan.com/entrances/store', supplier: 'https://console.zhudatuan.com/entrances/supplier',
        });
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/sessions')?.operation).toBe('identity.sessions.create');
    expect(bootstrapped.routes.match('GET', '/api/v1/identity/sessions')).toBeNull();
  });

  it('has no static dependency path to full Commerce, payment, providers, finance, WeChat, object storage, or cache', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'IdentityRegistrationApiMain.ts'));
    expect([...closure].filter((file) => [
      '/bootstrap/CommerceRuntime.ts',
      '/bootstrap/ProviderLoader.ts',
      '/app/modules.ts',
      '/modules/payment/',
      '/modules/finance/',
      '/modules/channel/',
      '/modules/identity/WechatOperations.ts',
      '/foundation/infrastructure/ObjectStore.ts',
      '/foundation/cache/',
    ].some((forbidden) => file.includes(forbidden)))).toEqual([]);
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
