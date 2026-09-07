import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD, type ApiEnvironment } from '@shop/config/server';
import type { OperationId } from '@shop/contract';
import { AccessPipeline } from '../foundation/security/AccessPipeline';
import { PgGovernanceResolver } from '../foundation/security/GovernanceResolver';
import { PgAccessVersionResolver, PgCapabilityResolver, PgMembershipResolver, PgScopeResolver, PgSessionResolver } from '../foundation/security/PgAccessResolvers';
import { PipelineAuthorizer } from '../foundation/security/PipelineAuthorizer';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { createPool, DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { QUERY_METRICS, QueryMetrics } from '../foundation/persistence/QueryMetrics';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { ExtensionRegistry } from './ExtensionRegistry';
import type { Container } from './Container';
import { bindServerNodeManifestRegistry } from './ApiBootstrap';
import { PgDecisionSink } from '../modules/access/04_adapters_shixian/persistence/PgDecisionSink';
import { RiskCheckAdapter } from '../modules/risk';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { RecordAudit } from '../modules/audit/03_application_yingyong/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/04_adapters_shixian/persistence/PgAuditRepository';
import { commerceTelemetry, TELEMETRY } from '../foundation/telemetry/Telemetry';

export const CONSOLE_SUPPORT_SCHEMA_VERSION = '20260902133000' as const;
export const CONSOLE_SUPPORT_SCHEMA_CHECKSUM = '0773015646b923fcf9e66a68c444fc164f6fadfb49d48f19344d59d638d66c4a' as const;

interface ConsoleSupportCompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly support: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly selected_access: boolean;
}

export interface ConsoleSupportRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createConsoleSupportRuntime(environment: ApiEnvironment): Promise<ConsoleSupportRuntime> {
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const connection = await secrets.read(required(environment.DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING'));
  const metrics = new QueryMetrics();
  const pool = createPool(connection, 'api', metrics);
  try {
    await assertConsoleSupportRuntimeCompatibility(pool);
  } catch (cause) {
    await pool.end();
    throw cause;
  }
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const telemetry = commerceTelemetry();
  const risk = new RiskCheckAdapter(pool);
  const audit = new RecordAudit(new PgAuditRepository());
  const access = new AccessPipeline(new PgSessionResolver(pool), new PgMembershipResolver(pool), new PgAccessVersionResolver(pool),
    new PgScopeResolver(pool), new PgCapabilityResolver(pool), new SystemClock(), risk, new PgDecisionSink(pool),
    undefined, undefined, new PgGovernanceResolver(pool));
  const handlers = new Map<OperationId, OperationHandler>();
  const kms = new KmsClient(
    required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
    required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'),
  );
  return {
    pool, extensions, telemetry,
    configure(container) {
      bindServerNodeManifestRegistry(container);
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(access));
      container.bind(DATABASE_POOL, pool);
      container.bind(QUERY_METRICS, metrics);
      container.bind(TELEMETRY, telemetry);
      container.bind(RISK_GATE, risk);
      container.bind(AUDIT_SINK, audit);
      container.bind(KMS_CLIENT, kms);
    },
    async close() { await pool.end(); },
  };
}

export async function consoleSupportRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<ConsoleSupportCompatibilityRow>> {
  const result = await pool.query<ConsoleSupportCompatibilityRow>(`select current_user,session_user,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    exists(select 1 from runtime.schemaversion where version=$4 and checksum=$5) support,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.idempotency'),to_regclass('runtime.outbox'),
      to_regclass('runtime.operation'),to_regclass('access.decisionaudit'),to_regclass('organization.unitclosure'),
      to_regclass('support.ticket'),to_regclass('support.conversation'),to_regclass('support.message'),
      to_regclass('support.history'),to_regclass('support.evidence'),to_regclass('risk.policy'),
      to_regclass('risk.policyversion'),to_regclass('risk.signal'),to_regclass('risk.decision'),
      to_regclass('risk.listentry'),to_regclass('risk.case'),to_regclass('audit.record'),
      to_regclass('audit.recorddefault'),to_regclass('audit.accessrecord'),to_regclass('audit.archiveref')
    ],null) is null relations,
    array_position(array[
      to_regprocedure('identity.resolve_session(text)'),to_regprocedure('access.resolve_membership(text)'),
      to_regprocedure('access.membership_version(text)'),to_regprocedure('access.resolve_scope(text,text,text,text)'),
      to_regprocedure('access.resolve_governance(text,text,text,text)'),
      to_regprocedure('access.resource_scope(text,text,text)'),to_regprocedure('access.scope_object(text)'),
      to_regprocedure('access.scope_allowed(text)'),to_regprocedure('capability.membership_operations(text)'),
      to_regprocedure('audit.scope_allowed(text)'),to_regprocedure('risk.scope_allowed(text)')
    ],null) is null
      and has_function_privilege(current_user,'identity.resolve_session(text)','EXECUTE')
      and has_function_privilege(current_user,'access.resolve_membership(text)','EXECUTE')
      and has_function_privilege(current_user,'access.membership_version(text)','EXECUTE')
      and has_function_privilege(current_user,'access.resolve_scope(text,text,text,text)','EXECUTE')
      and has_function_privilege(current_user,'access.resolve_governance(text,text,text,text)','EXECUTE')
      and has_function_privilege(current_user,'access.resource_scope(text,text,text)','EXECUTE')
      and has_function_privilege(current_user,'access.scope_object(text)','EXECUTE')
      and has_function_privilege(current_user,'access.scope_allowed(text)','EXECUTE')
      and has_function_privilege(current_user,'capability.membership_operations(text)','EXECUTE')
      and has_function_privilege(current_user,'audit.scope_allowed(text)','EXECUTE')
      and has_function_privilege(current_user,'risk.scope_allowed(text)','EXECUTE') functions,
    has_table_privilege(current_user,'runtime.schemaversion','SELECT')
      and has_table_privilege(current_user,'runtime.idempotency','SELECT,INSERT,UPDATE')
      and has_table_privilege(current_user,'runtime.outbox','INSERT')
      and has_table_privilege(current_user,'runtime.operation','SELECT')
      and has_table_privilege(current_user,'access.decisionaudit','INSERT')
      and has_table_privilege(current_user,'organization.unitclosure','SELECT')
      and has_table_privilege(current_user,'support.ticket','SELECT,UPDATE')
      and has_table_privilege(current_user,'support.conversation','SELECT,UPDATE')
      and has_table_privilege(current_user,'support.message','SELECT,INSERT')
      and has_table_privilege(current_user,'support.history','INSERT')
      and has_table_privilege(current_user,'support.evidence','SELECT')
      and has_table_privilege(current_user,'risk.policy','SELECT')
      and has_table_privilege(current_user,'risk.policyversion','SELECT')
      and has_table_privilege(current_user,'risk.signal','SELECT')
      and has_table_privilege(current_user,'risk.decision','SELECT,INSERT')
      and has_table_privilege(current_user,'risk.listentry','SELECT')
      and has_table_privilege(current_user,'risk.case','INSERT')
      and has_table_privilege(current_user,'audit.record','SELECT,INSERT')
      and has_table_privilege(current_user,'audit.recorddefault','SELECT,INSERT')
      and has_table_privilege(current_user,'audit.accessrecord','SELECT,INSERT')
      and has_table_privilege(current_user,'audit.archiveref','SELECT') selected_access`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM,
    CONSOLE_SUPPORT_SCHEMA_VERSION, CONSOLE_SUPPORT_SCHEMA_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'shopconsole' || state.session_user !== 'zhudatuanconsoleapi'
    || !state.writable || !state.schema || !state.contract || !state.support || !state.relations
    || !state.functions || !state.selected_access) {
    throw new Error(`CONSOLE_SUPPORT_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

export async function assertConsoleSupportRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  await consoleSupportRuntimeCompatibility(pool);
}

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
