import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import type { OperationId } from '@shop/contract';
import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD, WechatApplicationCatalog, purchasePaymentProviderEnabled,
  type PurchaseApiEnvironment } from '@shop/config/server';
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
import { PgGovernanceResolver } from '../foundation/security/GovernanceResolver';
import { PipelineAuthorizer } from '../foundation/security/PipelineAuthorizer';
import { DECISION_SINK } from '../foundation/security/DecisionSink';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { PgDecisionSink } from '../modules/access/04_adapters_shixian/persistence/PgDecisionSink';
import { RecordAudit } from '../modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { PAYMENT_GATEWAY } from '../modules/payment_zhifu/01_public_gongkai/ports_jiekou/PaymentGateway';
import { DisabledExternalPaymentGateway } from '../modules/purchase/DisabledExternalPaymentGateway';
import { WechatGateway } from '../modules/payment_zhifu/04_adapters_shixian/providers_waibu/WechatGateway';
import { PURCHASE_QUOTE_KEY } from '../modules/purchase/PurchaseOperations';
import { PurchaseSessionResolver } from '../modules/purchase/PurchaseSessionResolver';
import { WebBusinessScopeResolver } from '../modules/webbusiness/WebBusinessScopeResolver';
import { WebRiskCheckAdapter } from '../modules/webbusiness/WebRiskCheckAdapter';
import type { Container } from './Container';
import { ExtensionRegistry } from './ExtensionRegistry';

export const PURCHASE_SCHEMA_VERSION = '20260902011000' as const;
export const PURCHASE_SCHEMA_CHECKSUM = 'd53ccec069c3a040fb31977482ae3ebbb256a0d6285cf2e25f6a1497b8784549' as const;

interface CompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly role_safe: boolean;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly purchase: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly selected_writes: boolean;
  readonly forbidden_privileges: boolean;
}

export interface PurchaseApiRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createPurchaseApiRuntime(environment: PurchaseApiEnvironment): Promise<PurchaseApiRuntime> {
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const [connection, quoteKey] = await Promise.all([
    secrets.read(required(environment.DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING')),
    secrets.read(required(environment.QUOTE_KEY_REF, 'QUOTE_KEY_REF_MISSING')),
  ]);
  const paymentProviderEnabled = purchasePaymentProviderEnabled(environment);
  const provider = paymentProviderEnabled ? await Promise.all([
    secrets.read(required(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING')),
    secrets.read(required(environment.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING')),
  ]) : null;
  const kms = paymentProviderEnabled
    ? new KmsClient(required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
      required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'))
    : disabledPaymentKms();
  const payment = provider === null ? new DisabledExternalPaymentGateway() : new WechatGateway(
    WechatApplicationCatalog.parse(parseSecret(provider[0], 'WECHAT_APPLICATION_CONFIG_INVALID')),
    parseSecret(provider[1], 'WECHAT_PAYMENT_CONFIG_INVALID') as unknown as ConstructorParameters<typeof WechatGateway>[1],
  );
  if (!paymentProviderEnabled) console.warn('PURCHASE_EXTERNAL_PAYMENT_DISABLED');
  const pool = createPool(connection, 'api');
  try {
    await assertPurchaseRuntimeCompatibility(pool);
  } catch (cause) {
    await pool.end();
    throw cause;
  }
  const risk = new WebRiskCheckAdapter(pool);
  const decisions = new PgDecisionSink(pool);
  const audit = new RecordAudit(new PgAuditRepository());
  const access = new AccessPipeline(
    new PurchaseSessionResolver(new PgSessionResolver(pool)),
    new PgMembershipResolver(pool),
    new PgAccessVersionResolver(pool),
    new WebBusinessScopeResolver(pool),
    new PgCapabilityResolver(pool),
    new SystemClock(),
    risk,
    decisions,
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
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, new PipelineAuthorizer(access));
      container.bind(DATABASE_POOL, pool);
      container.bind(RISK_GATE, risk);
      container.bind(DECISION_SINK, decisions);
      container.bind(AUDIT_SINK, audit);
      container.bind(PURCHASE_QUOTE_KEY, quoteKey);
      container.bind(KMS_CLIENT, kms);
      container.bind(PAYMENT_GATEWAY, payment);
    },
    async close() {
      await extensions.stop();
      await pool.end();
    },
  });
}

export async function purchaseRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,session_user,
    not exists(select 1 from pg_roles role where role.rolname=current_user
      and (role.rolsuper or role.rolcreatedb or role.rolcreaterole or role.rolinherit or role.rolreplication or role.rolbypassrls))
      and not exists(select 1 from pg_auth_members membership
        join pg_roles granted on granted.oid=membership.roleid join pg_roles member on member.oid=membership.member
        where granted.rolname=current_user or member.rolname=current_user) role_safe,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    exists(select 1 from runtime.schemaversion where version=$4 and checksum=$5) purchase,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.idempotency'),to_regclass('runtime.outbox'),to_regclass('runtime.job'),
      to_regclass('identity.session'),to_regclass('access.membership'),to_regclass('access.decisionaudit'),to_regclass('member.profile'),
      to_regclass('organization.organization'),to_regclass('organization.unitclosure'),to_regclass('audit.record'),
      to_regclass('catalog.product'),to_regclass('catalog.sku'),to_regclass('catalog.listing'),to_regclass('catalog.sourcelisting'),
      to_regclass('pricing.pricebook'),to_regclass('pricing.price'),to_regclass('pricing.quote'),to_regclass('cart.cart'),to_regclass('cart.item'),
      to_regclass('checkout.address'),to_regclass('checkout.session'),to_regclass('checkout.evidence'),
      to_regclass('qualification.profile'),to_regclass('qualification.policy'),to_regclass('qualification.policyversion'),
      to_regclass('experience.application'),to_regclass('experience.publication'),
      to_regclass('inventory.stockitem'),to_regclass('inventory.reservation'),to_regclass('inventory.movement'),
      to_regclass('benefit.account'),to_regclass('benefit.reservation'),to_regclass('benefit.lot'),to_regclass('benefit.lotmovement'),
      to_regclass('ordering.orderrecord'),to_regclass('ordering.line'),to_regclass('ordering.suborder'),
      to_regclass('payment.intent'),to_regclass('payment.intenttender'),to_regclass('payment.payment'),
      to_regclass('payment.capture'),to_regclass('payment.allocation'),to_regclass('payment.attempt'),to_regclass('payment.prepay'),
      to_regclass('fulfillment.fulfillmentorder'),to_regclass('fulfillment.line')
    ],null) is null relations,
    array_position(array[
      to_regprocedure('identity.resolve_session(text)'),to_regprocedure('access.resolve_membership(text)'),
      to_regprocedure('access.membership_version(text)'),to_regprocedure('access.resolve_scope(text,text,text)'),
      to_regprocedure('access.resolve_scope(text,text,text,text)'),
      to_regprocedure('capability.membership_operations(text)'),to_regprocedure('access.purchase_session_context(text,text,boolean)'),
      to_regprocedure('access.purchase_member_scope(text,text)'),to_regprocedure('access.purchase_checkout_context(text,text,text,text)'),
      to_regprocedure('access.purchase_order_quote(text,text,text)'),
      to_regprocedure('access.purchase_payment_intent_context(text,text,text,text,text)'),
      to_regprocedure('access.purchase_enqueue_payment_query(text,text,text,text,integer,integer)'),
      to_regprocedure('benefit.purchase_available(text,text,text[])'),
      to_regprocedure('benefit.purchase_reserve(text,text,text,text,text[],bigint[])'),
      to_regprocedure('benefit.purchase_consume(text,text,text,text,text,bigint)')
    ],null) is null functions,
    has_table_privilege(current_user,'runtime.idempotency','SELECT')
      and has_table_privilege(current_user,'runtime.idempotency','INSERT')
      and not has_table_privilege(current_user,'runtime.idempotency','UPDATE')
      and has_column_privilege(current_user,'runtime.idempotency','state','UPDATE')
      and has_column_privilege(current_user,'runtime.idempotency','response','UPDATE')
      and not has_column_privilege(current_user,'runtime.idempotency','request_hash','UPDATE')
      and has_table_privilege(current_user,'runtime.outbox','INSERT')
      and has_table_privilege(current_user,'runtime.job','INSERT')
      and not has_table_privilege(current_user,'runtime.job','UPDATE')
      and not has_column_privilege(current_user,'runtime.job','state','UPDATE')
      and has_table_privilege(current_user,'pricing.quote','SELECT')
      and has_table_privilege(current_user,'pricing.quote','INSERT')
      and not has_table_privilege(current_user,'pricing.quote','UPDATE')
      and has_table_privilege(current_user,'checkout.session','SELECT')
      and has_table_privilege(current_user,'checkout.session','INSERT')
      and not has_table_privilege(current_user,'checkout.session','UPDATE')
      and has_column_privilege(current_user,'checkout.session','state','UPDATE')
      and has_column_privilege(current_user,'checkout.session','version','UPDATE')
      and not has_column_privilege(current_user,'checkout.session','member_id','UPDATE')
      and has_table_privilege(current_user,'checkout.evidence','INSERT')
      and not has_table_privilege(current_user,'cart.cart','UPDATE')
      and has_column_privilege(current_user,'cart.cart','state','UPDATE')
      and has_column_privilege(current_user,'cart.cart','updated_at','UPDATE')
      and has_column_privilege(current_user,'cart.cart','version','UPDATE')
      and not has_column_privilege(current_user,'cart.cart','member_id','UPDATE')
      and not has_table_privilege(current_user,'inventory.stockitem','UPDATE')
      and has_column_privilege(current_user,'inventory.stockitem','onhand','UPDATE')
      and has_column_privilege(current_user,'inventory.stockitem','version','UPDATE')
      and has_column_privilege(current_user,'inventory.stockitem','updated_at','UPDATE')
      and not has_column_privilege(current_user,'inventory.stockitem','scope_id','UPDATE')
      and has_table_privilege(current_user,'inventory.reservation','INSERT')
      and not has_table_privilege(current_user,'inventory.reservation','UPDATE')
      and has_column_privilege(current_user,'inventory.reservation','state','UPDATE')
      and has_column_privilege(current_user,'inventory.reservation','version','UPDATE')
      and not has_column_privilege(current_user,'inventory.reservation','owner_id','UPDATE')
      and has_table_privilege(current_user,'inventory.movement','INSERT')
      and not has_table_privilege(current_user,'marketing.campaign','UPDATE')
      and has_column_privilege(current_user,'marketing.campaign','spent_minor','UPDATE')
      and has_column_privilege(current_user,'marketing.campaign','version','UPDATE')
      and has_column_privilege(current_user,'marketing.campaign','updated_at','UPDATE')
      and not has_column_privilege(current_user,'marketing.campaign','scope_id','UPDATE')
      and has_table_privilege(current_user,'marketing.redemption','INSERT')
      and not has_table_privilege(current_user,'marketing.redemption','UPDATE')
      and has_column_privilege(current_user,'marketing.redemption','state','UPDATE')
      and has_column_privilege(current_user,'marketing.redemption','updated_at','UPDATE')
      and not has_column_privilege(current_user,'marketing.redemption','amount_minor','UPDATE')
      and has_table_privilege(current_user,'ordering.orderrecord','SELECT')
      and has_table_privilege(current_user,'ordering.orderrecord','INSERT')
      and not has_table_privilege(current_user,'ordering.orderrecord','UPDATE')
      and has_column_privilege(current_user,'ordering.orderrecord','payment_state','UPDATE')
      and has_column_privilege(current_user,'ordering.orderrecord','fulfillment_state','UPDATE')
      and has_column_privilege(current_user,'ordering.orderrecord','lifecycle_state','UPDATE')
      and has_column_privilege(current_user,'ordering.orderrecord','updated_at','UPDATE')
      and has_column_privilege(current_user,'ordering.orderrecord','version','UPDATE')
      and not has_column_privilege(current_user,'ordering.orderrecord','member_id','UPDATE')
      and not has_column_privilege(current_user,'ordering.orderrecord','mall_id','UPDATE')
      and not has_column_privilege(current_user,'ordering.orderrecord','total_minor','UPDATE')
      and has_table_privilege(current_user,'ordering.line','INSERT')
      and has_table_privilege(current_user,'ordering.suborder','INSERT')
      and has_sequence_privilege(current_user,'ordering.order_number_seq','USAGE')
      and has_table_privilege(current_user,'payment.intent','SELECT')
      and has_table_privilege(current_user,'payment.intent','INSERT')
      and not has_table_privilege(current_user,'payment.intent','UPDATE')
      and has_column_privilege(current_user,'payment.intent','state','UPDATE')
      and has_column_privilege(current_user,'payment.intent','version','UPDATE')
      and not has_column_privilege(current_user,'payment.intent','amount_minor','UPDATE')
      and has_table_privilege(current_user,'payment.intenttender','SELECT')
      and has_table_privilege(current_user,'payment.intenttender','INSERT')
      and not has_table_privilege(current_user,'payment.intenttender','UPDATE')
      and has_column_privilege(current_user,'payment.intenttender','state','UPDATE')
      and not has_column_privilege(current_user,'payment.intenttender','amount_minor','UPDATE')
      and has_table_privilege(current_user,'payment.attempt','SELECT')
      and has_table_privilege(current_user,'payment.attempt','INSERT')
      and not has_table_privilege(current_user,'payment.attempt','UPDATE')
      and has_column_privilege(current_user,'payment.attempt','state','UPDATE')
      and has_column_privilege(current_user,'payment.attempt','requested_at','UPDATE')
      and has_column_privilege(current_user,'payment.attempt','completed_at','UPDATE')
      and has_column_privilege(current_user,'payment.attempt','payer_hash','UPDATE')
      and not has_table_privilege(current_user,'payment.attempt','DELETE')
      and has_table_privilege(current_user,'payment.prepay','SELECT')
      and has_table_privilege(current_user,'payment.prepay','INSERT')
      and not has_table_privilege(current_user,'payment.prepay','UPDATE')
      and has_column_privilege(current_user,'payment.prepay','parameters','UPDATE')
      and has_column_privilege(current_user,'payment.prepay','provider_request_id','UPDATE')
      and not has_table_privilege(current_user,'payment.prepay','DELETE')
      and has_table_privilege(current_user,'payment.payment','SELECT')
      and has_table_privilege(current_user,'payment.payment','INSERT')
      and has_table_privilege(current_user,'payment.capture','INSERT')
      and has_table_privilege(current_user,'payment.allocation','INSERT')
      and has_table_privilege(current_user,'fulfillment.fulfillmentorder','SELECT')
      and has_table_privilege(current_user,'fulfillment.fulfillmentorder','INSERT')
      and has_table_privilege(current_user,'fulfillment.line','INSERT') selected_writes,
    not has_schema_privilege(current_user,'finance','USAGE')
      and not has_table_privilege(current_user,'payment.refund','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.recoverycase','INSERT,UPDATE,DELETE')
      and not exists(select 1 from pg_proc procedure
        join pg_namespace namespace on namespace.oid=procedure.pronamespace
        where namespace.nspname='finance' and procedure.proname='post'
          and oidvectortypes(procedure.proargtypes)=
            'text, text, text, text, text, text, text, text, text, bigint, timestamp with time zone'
          and has_function_privilege(current_user,procedure.oid,'EXECUTE')) forbidden_privileges`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, PURCHASE_SCHEMA_VERSION, PURCHASE_SCHEMA_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'zhudatuanpurchaseapi' || state.session_user !== 'zhudatuanpurchaseapi' || !state.role_safe
    || !state.writable || !state.schema || !state.contract || !state.purchase || !state.relations || !state.functions
    || !state.selected_writes || !state.forbidden_privileges) {
    throw new Error(`PURCHASE_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

export async function assertPurchaseRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  await purchaseRuntimeCompatibility(pool);
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

function disabledPaymentKms(): KmsClient {
  const unavailable = async (): Promise<never> => { throw new Error('EXTERNAL_PAYMENT_DISABLED'); };
  return Object.freeze({ encrypt: unavailable, decrypt: unavailable }) as unknown as KmsClient;
}
