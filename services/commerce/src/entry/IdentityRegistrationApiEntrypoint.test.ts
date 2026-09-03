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
import { IdentityOperatorVoucherModule } from '../modules/voucher/IdentityOperatorVoucherModule';
import { VOUCHER_OPERATOR_READ_OPERATION_IDS } from '../modules/voucher/VoucherReadOperations';
import { WECHAT_IDENTITY } from '../modules/identity/application/port/WechatIdentity';

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
      'identity.members.create',
      'identity.password.reset',
      'identity.password.verify',
      'identity.mobile.challenge',
      'identity.mobile.manage',
      'identity.stepup.start',
      'identity.stepup.complete',
      'identity.wechat.session',
      'identity.wechat.bind',
      'member.members.read',
      'member.invitations.read',
      'member.imports.read',
      'access.center.read',
      'finance.entries.read',
      'finance.statements.read',
      'finance.reconciliations.read',
      'finance.settlements.read',
      'finance.withdrawals.read',
      'invoice.requests.read',
      'referral.settings.read',
      'referral.products.read',
      'referral.members.read',
      'referral.bindings.read',
      'referral.commissions.read',
      'channel.connections.read',
      'channel.syncruns.read',
      'channel.operations.read',
      'voucher.cardlibraries.read',
      'voucher.programs.read',
      'voucher.reserves.read',
      'voucher.batches.read',
      'voucher.imports.read',
      'reporting.categories.read',
      'reporting.channels.read',
      'reporting.malls.read',
      'reporting.powderclass.read',
      'reporting.products.read',
      'reporting.sales.read',
      'reporting.voucherconsumption.read',
      'catalog.imports.read',
      'experience.applications.create',
      'experience.applications.read',
      'experience.applications.update',
      'experience.applications.copy',
      'notification.announcements.read',
      'notification.templates.read',
      'qualification.center.read',
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
        container.bind(WECHAT_IDENTITY, {
          application: () => ({ applicationHash: 'application:test' }),
          authorize: () => 'https://wechat.example.test/authorize',
          exchange: async () => ({ subject: 'openid:test' }),
        });
        container.bind(RETURN_TARGETS, {
          console: 'https://console.zhudatuan.com', storefront: 'https://zhudatuan.com',
          store: 'https://console.zhudatuan.com/entrances/store', supplier: 'https://console.zhudatuan.com/entrances/supplier',
        });
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/sessions')?.operation).toBe('identity.sessions.create');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/password/reset')?.operation).toBe('identity.password.reset');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/password/verify')?.operation).toBe('identity.password.verify');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/mobile/challenges')?.operation).toBe('identity.mobile.challenge');
    expect(bootstrapped.routes.match('PUT', '/api/v1/identity/mobile')?.operation).toBe('identity.mobile.manage');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/stepup/challenges')?.operation).toBe('identity.stepup.start');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/stepup/verifications')?.operation).toBe('identity.stepup.complete');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/wechat/sessions')?.operation).toBe('identity.wechat.session');
    expect(bootstrapped.routes.match('POST', '/api/v1/identity/wechat/bindings')?.operation).toBe('identity.wechat.bind');
    expect(bootstrapped.routes.match('GET', '/api/v1/identity/sessions')).toBeNull();
  });

  it('has no static dependency path to full Commerce, payment, providers, full finance, object storage, or cache', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'IdentityRegistrationApiMain.ts'));
    expect(
      [...closure].filter((file) =>
        [
          '/bootstrap/CommerceRuntime.ts',
          '/bootstrap/ProviderLoader.ts',
          '/app/modules.ts',
          '/modules/payment/',
          '/modules/finance/FinanceModule.ts',
          '/modules/finance/interface/http/FinanceRoutes.ts',
          '/modules/channel/ChannelModule.ts',
          '/modules/channel/interface/http/ChannelRoutes.ts',
          '/modules/referral/ReferralModule.ts',
          '/modules/referral/ReferralOperations.ts',
          '/modules/voucher/VoucherModule.ts',
          '/modules/voucher/VoucherOperations.ts',
          '/modules/catalog/CatalogModule.ts',
          '/modules/catalog/CatalogOperations.ts',
          '/modules/experience/ExperienceModule.ts',
          '/modules/experience/ExperienceOperations.ts',
          '/modules/notification/NotificationModule.ts',
          '/modules/notification/interface/http/NotificationRoutes.ts',
          '/modules/qualification/QualificationModule.ts',
          '/modules/qualification/QualificationOperations.ts',
          '/modules/access/AccessModule.ts',
          '/modules/access/AccessOperations.ts',
          '/foundation/infrastructure/ObjectStore.ts',
          '/foundation/cache/',
        ].some((forbidden) => file.includes(forbidden))
      )
    ).toEqual([]);
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
