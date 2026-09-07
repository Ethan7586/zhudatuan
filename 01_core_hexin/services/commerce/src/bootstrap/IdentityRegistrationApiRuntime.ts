import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import type { OperationId } from '@shop/contract';
import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD, WechatApplicationCatalog, identityRegistrationApiReturnTargets, type IdentityRegistrationApiEnvironment } from '@shop/config/server';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { HttpObjectStore, OBJECT_STORE } from '../foundation/infrastructure/ObjectStore';
import { IDENTITY_SECURITY_KEYS, SECRET_STORE, WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { createPool, DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { AccessPipeline } from '../foundation/security/AccessPipeline';
import { PgAccessVersionResolver, PgCapabilityResolver, PgMembershipResolver, PgScopeResolver, PgSessionResolver } from '../foundation/security/PgAccessResolvers';
import { PgGovernanceResolver } from '../foundation/security/GovernanceResolver';
import { PipelineAuthorizer } from '../foundation/security/PipelineAuthorizer';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { PgDecisionSink } from '../modules/access/04_adapters_shixian/persistence/PgDecisionSink';
import { RecordAudit } from '../modules/audit/03_application_yingyong/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/04_adapters_shixian/persistence/PgAuditRepository';
import { RETURN_TARGETS } from '../modules/identity/04_adapters_shixian/providers_waibu/ReturnTargetCatalog';
import { RiskCheckAdapter } from '../modules/risk';
import { WECHAT_IDENTITY } from '../modules/identity/01_public_gongkai/ports_jiekou/WechatIdentity';
import { WechatIdentityGateway, type WechatIdentityConfiguration } from '../modules/identity/04_adapters_shixian/providers_waibu/WechatIdentityGateway';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import type { Container } from './Container';
import { bindServerNodeManifestRegistry } from './ApiBootstrap';
import { ExtensionRegistry } from './ExtensionRegistry';
import { assertIdentityRuntimeDatabaseBoundary } from './LiveDatabaseBoundary';

interface CompatibilityRow {
  readonly current_user: string;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly registration: boolean;
  readonly operator_invitation: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly catalog_writes: boolean;
}

export interface IdentityRegistrationApiRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createIdentityRegistrationApiRuntime(
  environment: IdentityRegistrationApiEnvironment,
): Promise<IdentityRegistrationApiRuntime> {
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const [connection, sessionKey, identityKey, applicationSource, wechatIdentitySource] = await Promise.all([
    secrets.read(required(environment.DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING')),
    secrets.read(required(environment.SESSION_KEY_REF, 'SESSION_KEY_REF_MISSING')),
    secrets.read(required(environment.IDENTITY_KEY_REF, 'IDENTITY_KEY_REF_MISSING')),
    secrets.read(required(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING')),
    secrets.read(required(environment.WECHAT_IDENTITY_CONFIG_REF, 'WECHAT_IDENTITY_CONFIG_REF_MISSING')),
  ]);
  const applications = WechatApplicationCatalog.parse(parseSecret(applicationSource, 'WECHAT_APPLICATION_CONFIG_INVALID'));
  const wechatIdentity = new WechatIdentityGateway(applications,
    parseSecret(wechatIdentitySource, 'WECHAT_IDENTITY_CONFIG_INVALID') as unknown as WechatIdentityConfiguration);
  const pool = createPool(connection, 'api');
  const objects = new HttpObjectStore(
    required(environment.OBJECT_STORE_ENDPOINT, 'OBJECT_STORE_ENDPOINT_MISSING'),
    required(environment.OBJECT_STORE_BEARER_TOKEN, 'OBJECT_STORE_BEARER_TOKEN_MISSING'),
  );
  try {
    await assertIdentityRegistrationRuntimeCompatibility(pool)
      .catch((cause: unknown) => console.warn('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_WARNING', cause));
    await objects.find('catalog/readiness-probe');
  } catch (cause) {
    await pool.end();
    throw cause;
  }
  const risk = new RiskCheckAdapter(pool);
  const audit = new RecordAudit(new PgAuditRepository());
  const access = new AccessPipeline(
    new PgSessionResolver(pool),
    new PgMembershipResolver(pool),
    new PgAccessVersionResolver(pool),
    new PgScopeResolver(pool),
    new PgCapabilityResolver(pool),
    new SystemClock(),
    risk,
    new PgDecisionSink(pool),
    undefined,
    undefined,
    new PgGovernanceResolver(pool),
  );
  const handlers = new Map<OperationId, OperationHandler>();
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const telemetry = commerceTelemetry();
  return Object.freeze({
    pool,
    extensions,
    telemetry,
    configure(container: Container) {
      bindServerNodeManifestRegistry(container);
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(access));
      container.bind(DATABASE_POOL, pool);
      container.bind(RISK_GATE, risk);
      container.bind(AUDIT_SINK, audit);
      container.bind(SECRET_STORE, secrets);
      container.bind(IDENTITY_SECURITY_KEYS, Object.freeze({ session: sessionKey, identity: identityKey }));
      container.bind(KMS_CLIENT, new KmsClient(
        required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
        required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'),
      ));
      container.bind(OBJECT_STORE, objects);
      container.bind(WECHAT_IDENTITY, wechatIdentity);
      container.bind(RETURN_TARGETS, identityRegistrationApiReturnTargets(environment));
    },
    async close() {
      await extensions.stop();
      await pool.end();
    },
  });
}

export async function identityRegistrationRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    exists(select 1 from runtime.schemaversion where version='20260828170000'
      and checksum='5cf87482ba3d0db32500809d28a77973ac285657aeb9c14612ba3dc525a2965e') registration,
    exists(select 1 from runtime.schemaversion where version='20260829060000'
      and checksum='b1e238eb8de569b0de9d1d2766620e1f661268d2f9260e646208d4f24715b37a') operator_invitation,
    to_regprocedure('access.resolve_scope(text,text,text,text)') is not null functions,
    array_position(array[
      to_regclass('runtime.idempotency'),to_regclass('runtime.job'),to_regclass('runtime.outbox'),
      to_regclass('identity.principal'),to_regclass('identity.credential'),to_regclass('identity.session'),
      to_regclass('identity.authticket'),to_regclass('identity.challenge'),to_regclass('identity.challengesecret'),
      to_regclass('identity.registrationpolicy'),to_regclass('member.invite'),to_regclass('member.profile'),
      to_regclass('access.membership'),to_regclass('access.membershiprole'),to_regclass('access.scopegrant'),
      to_regclass('organization.organization'),to_regclass('audit.record'),to_regclass('audit.accessrecord')
      ,to_regclass('catalog.importjob'),to_regclass('catalog.importrow'),to_regclass('catalog.importerror'),
      to_regclass('catalog.listing')
    ],null) is null relations,
    has_table_privilege(current_user,'catalog.importjob','SELECT')
      and has_table_privilege(current_user,'catalog.importjob','INSERT')
      and has_table_privilege(current_user,'catalog.importjob','UPDATE')
      and has_table_privilege(current_user,'catalog.importrow','SELECT')
      and has_table_privilege(current_user,'catalog.importerror','SELECT')
      and has_table_privilege(current_user,'catalog.listing','SELECT')
      and has_table_privilege(current_user,'catalog.listing','UPDATE') catalog_writes`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'zhudatuanidentityapi' || !state.writable || !state.schema || !state.contract
    || !state.registration || !state.operator_invitation || !state.relations || !state.functions || !state.catalog_writes) {
    throw new Error(`IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

export async function assertIdentityRegistrationRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  await identityRegistrationRuntimeCompatibility(pool);
  await assertIdentityRuntimeDatabaseBoundary(pool, 'zhudatuanidentityapi');
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

function parseSecret(value: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(code); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(code);
  return parsed as Record<string, unknown>;
}
