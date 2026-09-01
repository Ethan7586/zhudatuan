import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import type { OperationId } from '@shop/contract';
import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD, type WebBusinessApiEnvironment } from '@shop/config/server';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { KMS_CLIENT, KmsClient } from '../foundation/infrastructure/KmsClient';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { createPool, DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { AccessPipeline } from '../foundation/security/AccessPipeline';
import {
  PgAccessVersionResolver,
  PgCapabilityResolver,
  PgMembershipResolver,
  PgSessionResolver,
} from '../foundation/security/PgAccessResolvers';
import { PipelineAuthorizer } from '../foundation/security/PipelineAuthorizer';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { PgDecisionSink } from '../modules/access/infrastructure/persistence/PgDecisionSink';
import { RecordAudit } from '../modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { WebRiskCheckAdapter } from '../modules/webbusiness/WebRiskCheckAdapter';
import { WebBusinessScopeResolver } from '../modules/webbusiness/WebBusinessScopeResolver';
import type { Container } from './Container';
import { ExtensionRegistry } from './ExtensionRegistry';

export const WEB_BUSINESS_SCHEMA_VERSION = '20260828180000' as const;
export const WEB_BUSINESS_SCHEMA_CHECKSUM = '0d3eb3e766c32ea0dada6a982bb07a1e797f0b3a08d8104235f2894f3721d81c' as const;

interface CompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly role_safe: boolean;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly web_business: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly selected_writes: boolean;
  readonly forbidden_writes: boolean;
}

export interface WebBusinessApiRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createWebBusinessApiRuntime(
  environment: WebBusinessApiEnvironment,
): Promise<WebBusinessApiRuntime> {
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const connection = await secrets.read(required(environment.DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING'));
  const pool = createPool(connection, 'api');
  try {
    await assertWebBusinessRuntimeCompatibility(pool)
      .catch((cause: unknown) => console.warn('WEB_BUSINESS_RUNTIME_COMPATIBILITY_WARNING', cause));
  } catch (cause) {
    await pool.end();
    throw cause;
  }
  const risk = new WebRiskCheckAdapter(pool);
  const audit = new RecordAudit(new PgAuditRepository());
  const access = new AccessPipeline(
    new PgSessionResolver(pool),
    new PgMembershipResolver(pool),
    new PgAccessVersionResolver(pool),
    new WebBusinessScopeResolver(pool),
    new PgCapabilityResolver(pool),
    new SystemClock(),
    risk,
    new PgDecisionSink(pool),
  );
  const handlers = new Map<OperationId, OperationHandler>();
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const telemetry = commerceTelemetry();
  return Object.freeze({
    pool,
    extensions,
    telemetry,
    configure(container: Container) {
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(access));
      container.bind(DATABASE_POOL, pool);
      container.bind(RISK_GATE, risk);
      container.bind(AUDIT_SINK, audit);
      container.bind(KMS_CLIENT, new KmsClient(
        required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
        required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'),
      ));
    },
    async close() {
      await extensions.stop();
      await pool.end();
    },
  });
}

export async function webBusinessRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,session_user,
    not exists(select 1 from pg_roles role where role.rolname=current_user
      and (role.rolsuper or role.rolcreatedb or role.rolcreaterole or role.rolinherit or role.rolreplication or role.rolbypassrls))
      and not exists(select 1 from pg_auth_members membership
        join pg_roles granted on granted.oid=membership.roleid join pg_roles member on member.oid=membership.member
        where granted.rolname=current_user or member.rolname=current_user) role_safe,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    exists(select 1 from runtime.schemaversion where version=$4 and checksum=$5) web_business,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.idempotency'),
      to_regclass('identity.session'),to_regclass('access.membership'),to_regclass('access.decisionaudit'),
      to_regclass('member.profile'),to_regclass('organization.organization'),to_regclass('organization.unitclosure'),
      to_regclass('risk.policy'),to_regclass('risk.policyversion'),to_regclass('risk.signal'),to_regclass('risk.listentry'),
      to_regclass('audit.record'),to_regclass('audit.accessrecord'),to_regclass('audit.archiveref'),
      to_regclass('reporting.metric'),to_regclass('reporting.fact'),to_regclass('catalog.product'),to_regclass('catalog.sku'),
      to_regclass('catalog.listing'),to_regclass('catalog.sourcelisting'),to_regclass('pricing.pricebook'),to_regclass('pricing.price'),
      to_regclass('inventory.stockitem'),to_regclass('inventory.reservation'),to_regclass('experience.application'),
      to_regclass('cart.cart'),to_regclass('cart.item'),to_regclass('checkout.address'),
      to_regclass('benefit.account'),to_regclass('benefit.lot'),
      to_regclass('ordering.orderrecord'),to_regclass('ordering.line'),to_regclass('ordering.aftersale'),
      to_regclass('fulfillment.fulfillmentorder')
    ],null) is null relations,
    array_position(array[
      to_regprocedure('identity.resolve_session(text)'),to_regprocedure('access.resolve_membership(text)'),
      to_regprocedure('access.membership_version(text)'),to_regprocedure('access.resolve_scope(text,text,text)'),
      to_regprocedure('access.resolve_scope(text,text,text,text)'),
      to_regprocedure('access.resource_scope(text,text,text)'),to_regprocedure('access.scope_object(text)'),
      to_regprocedure('access.scope_allowed(text)'),to_regprocedure('capability.membership_operations(text)'),
      to_regprocedure('risk.scope_allowed(text)'),to_regprocedure('audit.scope_allowed(text)'),
      to_regprocedure('reporting.cockpit(text)'),to_regprocedure('benefit.web_account_balance(text,text)'),
      to_regprocedure('benefit.web_ledger(text,text)'),
      to_regprocedure('access.web_member_scope(text,text)'),to_regprocedure('access.web_storefront_scope(text,text)'),
      to_regprocedure('access.web_risk_scope_allowed(text)')
    ],null) is null functions,
    has_table_privilege(current_user,'runtime.idempotency','SELECT')
      and has_table_privilege(current_user,'runtime.idempotency','INSERT')
      and has_table_privilege(current_user,'runtime.idempotency','UPDATE')
      and has_table_privilege(current_user,'cart.cart','SELECT')
      and has_table_privilege(current_user,'cart.cart','INSERT')
      and has_table_privilege(current_user,'cart.cart','UPDATE')
      and has_table_privilege(current_user,'cart.item','SELECT')
      and has_table_privilege(current_user,'cart.item','INSERT')
      and has_table_privilege(current_user,'cart.item','UPDATE')
      and has_table_privilege(current_user,'cart.item','DELETE')
      and has_table_privilege(current_user,'checkout.address','SELECT')
      and has_table_privilege(current_user,'checkout.address','INSERT')
      and has_table_privilege(current_user,'checkout.address','UPDATE')
      and has_table_privilege(current_user,'access.decisionaudit','SELECT')
      and has_table_privilege(current_user,'access.decisionaudit','INSERT')
      and has_table_privilege(current_user,'audit.record','SELECT')
      and has_table_privilege(current_user,'audit.record','INSERT')
      and has_table_privilege(current_user,'audit.accessrecord','SELECT')
      and has_table_privilege(current_user,'audit.accessrecord','INSERT')
      and has_table_privilege(current_user,'audit.archiveref','SELECT') selected_writes,
    not has_table_privilege(current_user,'ordering.orderrecord','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'ordering.line','INSERT,UPDATE,DELETE')
      and not has_schema_privilege(current_user,'payment','USAGE')
      and not has_schema_privilege(current_user,'finance','USAGE')
      and has_function_privilege(current_user,'benefit.web_ledger(text,text)','EXECUTE') forbidden_writes`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, WEB_BUSINESS_SCHEMA_VERSION, WEB_BUSINESS_SCHEMA_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'zhudatuanwebapi' || state.session_user !== 'zhudatuanwebapi' || !state.role_safe
    || !state.writable || !state.schema || !state.contract
    || !state.web_business || !state.relations || !state.functions || !state.selected_writes || !state.forbidden_writes) {
    throw new Error(`WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

export async function assertWebBusinessRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  await webBusinessRuntimeCompatibility(pool);
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
