import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import type { OperationId } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { bootstrapApi, SERVER_NODE_MANIFEST_REGISTRY } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { IDENTITY_SECURITY_KEYS } from '../foundation/infrastructure/SecretStore';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import {
  ACCESS_IDENTITY_OPERATOR_OPERATION_IDS,
  IdentityOperatorAccessModule,
} from '../modules/access/05_interface_jieru/IdentityOperatorAccessModule';
import { AUDIT_PORT } from '../modules/audit/01_public_gongkai/AuditPort';
import { AuditModule } from '../modules/audit/05_interface_jieru/AuditModule';
import { auditManifest } from '../modules/audit/module.manifest';
import { CHANNEL_OPERATOR_READ_OPERATION_IDS } from '../modules/channel/ChannelReadOperations';
import { IdentityOperatorChannelModule } from '../modules/channel/IdentityOperatorChannelModule';
import { EXPERIENCE_OPERATOR_OPERATION_IDS } from '../modules/experience/ExperienceOperatorOperations';
import { IdentityOperatorExperienceModule } from '../modules/experience/IdentityOperatorExperienceModule';
import { IDENTITY_REGISTRATION_OPERATION_IDS } from '../modules/identity';
import { IdentityRegistrationModule } from '../modules/identity';
import { FINANCE_OPERATOR_READ_OPERATION_IDS } from '../modules/finance/FinanceReadOperations';
import { IdentityOperatorFinanceModule } from '../modules/finance/IdentityOperatorFinanceModule';
import { MEMBER_OPERATOR_READ_OPERATION_IDS } from '../modules/member/03_application_yingyong/MemberReadOperations';
import { IdentityOperatorMemberModule, MEMBER_IDENTITY_OPERATOR_OPERATION_IDS } from '../modules/member/05_interface_jieru/IdentityOperatorMemberModule';
import { IdentityOperatorNotificationModule } from '../modules/notification/IdentityOperatorNotificationModule';
import { NOTIFICATION_OPERATOR_READ_OPERATION_IDS } from '../modules/notification/NotificationReadOperations';
import {
  IdentityOperatorQualificationModule,
  QUALIFICATION_OPERATOR_READ_OPERATION_IDS,
} from '../modules/qualification/operator';
import { IdentityOperatorReferralModule } from '../modules/referral/IdentityOperatorReferralModule';
import { REFERRAL_OPERATOR_READ_OPERATION_IDS } from '../modules/referral/ReferralReadOperations';
import { IdentityOperatorReportingModule } from '../modules/reporting/IdentityOperatorReportingModule';
import { REPORTING_OPERATOR_READ_OPERATION_IDS } from '../modules/reporting/ReportingReadOperations';
import { IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS } from '../modules/runtime/IdentityRegistrationRuntimeOperations';
import { IdentityRegistrationRuntimeModule } from '../modules/runtime/IdentityRegistrationRuntimeModule';
import { IdentityOperatorVoucherModule } from '../modules/voucher/05_interface_jieru/IdentityOperatorVoucherModule';
import { VOUCHER_OPERATOR_READ_OPERATION_IDS } from '../modules/voucher/03_application_yingyong/VoucherReadOperations';
import { WECHAT_IDENTITY } from '../modules/identity';

describe('identity registration API entrypoint', () => {
  it('exposes only the approved identity and selected operator operations', () => {
    expect([
      ...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS,
      ...IDENTITY_REGISTRATION_OPERATION_IDS,
      ...MEMBER_IDENTITY_OPERATOR_OPERATION_IDS,
      ...ACCESS_IDENTITY_OPERATOR_OPERATION_IDS,
      ...auditManifest.operations,
      ...FINANCE_OPERATOR_READ_OPERATION_IDS,
      ...REFERRAL_OPERATOR_READ_OPERATION_IDS,
      ...CHANNEL_OPERATOR_READ_OPERATION_IDS,
      ...VOUCHER_OPERATOR_READ_OPERATION_IDS,
      ...REPORTING_OPERATOR_READ_OPERATION_IDS,
      ...EXPERIENCE_OPERATOR_OPERATION_IDS,
      ...NOTIFICATION_OPERATOR_READ_OPERATION_IDS,
      ...QUALIFICATION_OPERATOR_READ_OPERATION_IDS,
    ]).toEqual([
      'runtime.health.live',
      'runtime.health.ready',
      'runtime.health.startup',
      'identity.sessions.create',
      'identity.loginintents.create',
      'identity.tickets.exchange',
      'identity.session.read',
      'identity.session.delete',
      'identity.challenges.create',
      'identity.invitations.read',
      'identity.storefronts.read',
      'identity.invitations.create',
      'identity.invitations.revoke',
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
      'member.storefront.members.read',
      'member.storefront.detail.read',
      'member.storefront.invitees.read',
      'member.storefront.orders.read',
      'member.invitations.read',
      'member.imports.read',
      'member.storefront.config.read',
      'member.storefront.config.manage',
      'member.storefront.custom.read',
      'member.storefront.custom.manage',
      'access.center.read',
      'access.roles.manage',
      'access.scopes.manage',
      'access.administrators.members.read',
      'access.administrators.member.read',
      'access.administrators.scopes.manage',
      'access.administrators.members.note',
      'access.ownership.read',
      'access.ownership.transfers.preview',
      'access.ownership.transfers.create',
      'access.ownership.transfers.accept.preview',
      'access.ownership.transfers.accept',
      'access.ownership.transfers.cancel.preview',
      'access.ownership.transfers.cancel',
      'audit.records.read',
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
    const operationIds = [
      ...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS,
      ...IDENTITY_REGISTRATION_OPERATION_IDS,
      ...MEMBER_OPERATOR_READ_OPERATION_IDS,
      ...ACCESS_IDENTITY_OPERATOR_OPERATION_IDS,
      ...auditManifest.operations,
      ...FINANCE_OPERATOR_READ_OPERATION_IDS,
      ...REFERRAL_OPERATOR_READ_OPERATION_IDS,
      ...CHANNEL_OPERATOR_READ_OPERATION_IDS,
      ...VOUCHER_OPERATOR_READ_OPERATION_IDS,
      ...REPORTING_OPERATOR_READ_OPERATION_IDS,
      ...EXPERIENCE_OPERATOR_OPERATION_IDS,
      ...NOTIFICATION_OPERATOR_READ_OPERATION_IDS,
      ...QUALIFICATION_OPERATOR_READ_OPERATION_IDS,
    ];
    const pool = { workload: () => pool } as unknown as DatabasePool;
    const extensions = new ExtensionRegistry({ verify: async () => false });
    const bootstrapped = await bootstrapApi({
      modules: [
        IdentityRegistrationRuntimeModule,
        IdentityRegistrationModule,
        IdentityOperatorMemberModule,
        IdentityOperatorAccessModule,
        AuditModule,
        IdentityOperatorFinanceModule,
        IdentityOperatorReferralModule,
        IdentityOperatorChannelModule,
        IdentityOperatorVoucherModule,
        IdentityOperatorReportingModule,
        IdentityOperatorExperienceModule,
        IdentityOperatorNotificationModule,
        IdentityOperatorQualificationModule,
      ],
      operationIds,
      nodeManifestRegistry: SERVER_NODE_MANIFEST_REGISTRY,
      runtimeNodeIds: ['node:hbbtzn:l1'],
      extensions,
      allowedOrigins: ['https://accounts.zhudatuan.com'],
      telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
        container.bind(OPERATION_AUTHORIZER, {
          authorize: async () => {
            throw new Error('AUTHORIZATION_NOT_CALLED');
          },
        });
        container.bind(DATABASE_POOL, pool);
        container.bind(AUDIT_SINK, { record: async () => undefined, access: async () => undefined });
        container.bind(AUDIT_PORT, {} as never);
        container.bind(RISK_GATE, {} as never);
        container.bind(IDENTITY_SECURITY_KEYS, { identity: 'identity-test-key', session: 'session-test-key' });
        container.bind(KMS_CLIENT, new KmsClient('https://kms.internal', 'k'.repeat(43)));
        container.bind(OBJECT_STORE, {
          create: async () => { throw new Error('OBJECT_UPLOAD_NOT_CALLED'); },
          find: async () => null,
          read: async () => new Uint8Array(),
          inspect: async () => { throw new Error('OBJECT_INSPECT_NOT_CALLED'); },
          authorize: async () => { throw new Error('OBJECT_AUTHORIZE_NOT_CALLED'); },
        });
        container.bind(WECHAT_IDENTITY, {
          application: () => ({ applicationHash: 'application:test' }),
          authorize: () => 'https://wechat.example.test/authorize',
          exchange: async () => ({ subject: 'openid:test' }),
          jsSdkConfiguration: async () => { throw new Error('not used'); },
        });
      },
    });
    expect(bootstrapped.routes.catalog().map(({ operation }) => operation)).toEqual(operationIds);
    expect(MEMBER_OPERATOR_READ_OPERATION_IDS.map((operation) =>
      bootstrapped.arch.state('node:hbbtzn:l1', operation)))
      .toEqual(MEMBER_OPERATOR_READ_OPERATION_IDS.map(() => 'connected'));
    expect(bootstrapped.arch.state('node:zhudatuan:l0', MEMBER_OPERATOR_READ_OPERATION_IDS[0]!)).toBe('unmounted');
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
    expect(bootstrapped.routes.match('GET', '/api/v1/members')?.operation).toBe('member.members.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/member/storefront-members/membership%3Aone')?.operation)
      .toBe('member.storefront.detail.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/member/storefront-members/membership%3Aone/invitees')?.operation)
      .toBe('member.storefront.invitees.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/member/storefront-members/membership%3Aone/orders')?.operation)
      .toBe('member.storefront.orders.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/members/imports/x')?.operation).toBe('member.imports.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/access/center')?.operation).toBe('access.center.read');
    expect(bootstrapped.routes.match('PUT', '/api/v1/access/roles/role%3Asenior')?.operation)
      .toBe('access.roles.manage');
    expect(bootstrapped.routes.match('PUT', '/api/v1/access/memberships/membership%3Aone/scopes')?.operation)
      .toBe('access.scopes.manage');
    expect(bootstrapped.routes.match('GET', '/api/v1/access/ownership')?.operation).toBe('access.ownership.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/audits')?.operation).toBe('audit.records.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/finance/entries')?.operation).toBe('finance.entries.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/finance/statements')?.operation).toBe('finance.statements.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/finance/reconciliations')?.operation).toBe('finance.reconciliations.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/finance/settlements')?.operation).toBe('finance.settlements.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/finance/withdrawals')?.operation).toBe('finance.withdrawals.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/invoices/requests')?.operation).toBe('invoice.requests.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/referral/settings')?.operation).toBe('referral.settings.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/referral/products')?.operation).toBe('referral.products.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/referral/members')?.operation).toBe('referral.members.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/referral/bindings')?.operation).toBe('referral.bindings.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/referral/commissions')?.operation).toBe('referral.commissions.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/channels/connections')?.operation).toBe('channel.connections.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/channels/syncruns')?.operation).toBe('channel.syncruns.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/channels/operations')?.operation).toBe('channel.operations.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/vouchers/cardlibraries')?.operation).toBe('voucher.cardlibraries.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/vouchers/programs')?.operation).toBe('voucher.programs.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/vouchers/reserves')?.operation).toBe('voucher.reserves.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/vouchers/batches')?.operation).toBe('voucher.batches.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/vouchers/imports/x')?.operation).toBe('voucher.imports.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/categories')?.operation).toBe('reporting.categories.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/channels')?.operation).toBe('reporting.channels.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/malls')?.operation).toBe('reporting.malls.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/powderclass')?.operation).toBe('reporting.powderclass.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/products')?.operation).toBe('reporting.products.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/sales')?.operation).toBe('reporting.sales.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/voucherconsumption')?.operation).toBe('reporting.voucherconsumption.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/catalog/imports/x')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/catalog/imports')).toBeNull();
    expect(bootstrapped.routes.match('PUT', '/api/v1/catalog/listings/listing:test/publication')).toBeNull();
    expect(bootstrapped.routes.match('DELETE', '/api/v1/catalog/listings/listing:test/publication')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/experiences/applications')?.operation).toBe('experience.applications.create');
    expect(bootstrapped.routes.match('GET', '/api/v1/experiences/applications')?.operation).toBe('experience.applications.read');
    expect(bootstrapped.routes.match('PATCH', '/api/v1/experiences/applications/application:test')?.operation).toBe('experience.applications.update');
    expect(bootstrapped.routes.match('POST', '/api/v1/experiences/applications/application:test/copies')?.operation).toBe('experience.applications.copy');
    expect(bootstrapped.routes.match('GET', '/api/v1/notifications/announcements')?.operation).toBe('notification.announcements.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/notifications/templates')?.operation).toBe('notification.templates.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/qualifications')?.operation).toBe('qualification.center.read');
    expect(bootstrapped.routes.match('GET', '/api/v1/reports/dashboard')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/reports/exports')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/finance/withdrawals')).toBeNull();
    expect(bootstrapped.routes.match('PUT', '/api/v1/referral/settings')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/channels/connections')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/experiences/applications/application:test/versions')).toBeNull();
    expect(bootstrapped.routes.match('PUT', '/api/v1/experiences/versions/version:test/publication')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/experiences/versions/version:test/restorations')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/experiences/versions/version:test/validation')).toBeNull();
    expect(bootstrapped.routes.match('PUT', '/api/v1/vouchers/programs/program:test')).toBeNull();
  });

  it('has no static dependency path to full Commerce, payment, providers, full finance, or cache', () => {
    const closure = sourceClosure(join(import.meta.dirname, 'IdentityRegistrationApiMain.ts'));
    expect(
      [...closure].filter((file) =>
        [
          '/bootstrap/CommerceRuntime.ts',
          '/bootstrap/ProviderLoader.ts',
          '/app/modules.ts',
          '/modules/payment_zhifu/',
          '/modules/finance/FinanceModule.ts',
          '/modules/finance/05_interface_jieru/http/FinanceRoutes.ts',
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
          '/modules/qualification/05_interface_jieru/QualificationModule.ts',
          '/modules/qualification/03_application_yingyong/QualificationOperations.ts',
          '/modules/access/05_interface_jieru/AccessModule.ts',
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
      const candidate = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base].find(existsSync);
      if (candidate) visit(candidate);
    }
  };
  visit(entry);
  return visited;
}
