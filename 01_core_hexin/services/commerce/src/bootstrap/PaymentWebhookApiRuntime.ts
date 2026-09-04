import type { OperationId } from '@shop/contract';
import {
  CONTRACT_SCHEMA_HEAD,
  RUNTIME_CONTRACT_CHECKSUM,
  WechatApplicationCatalog,
  type PaymentWebhookApiEnvironment,
} from '@shop/config/server';
import type { Telemetry } from '@shop/telemetry';
import type { OperationRequest, OperationUsecase } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { createPool, DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { RecordAudit } from '../modules/audit/03_application_yingyong/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/04_adapters_shixian/persistence/PgAuditRepository';
import { PAYMENT_GATEWAY } from '../modules/payment_zhifu/01_public_gongkai/ports_jiekou/PaymentGateway';
import { WechatGateway } from '../modules/payment_zhifu/04_adapters_shixian/providers_waibu/WechatGateway';
import { PaymentWebhook } from '../modules/payment_zhifu/05_interface_jieru/http/PaymentWebhook';
import type { Container } from './Container';
import { defineSelectedModule } from './DefinedModule';
import { ExtensionRegistry } from './ExtensionRegistry';
import type { ModuleContext } from './ModuleRegistry';

export const PAYMENT_WEBHOOK_OPERATION_IDS = Object.freeze([
  'payment.webhooks.wechat',
] as const satisfies readonly OperationId[]);
export const PAYMENT_WEBHOOK_SCHEMA_VERSION = '20260903110000' as const;
export const PAYMENT_WEBHOOK_SCHEMA_CHECKSUM = '6e08b67bcf8d7c496c7675ff38cb301da6ed0677fa30ecca4adeb80f5d6de889' as const;

export const PaymentWebhookApiModule = defineSelectedModule(
  'payment', PAYMENT_WEBHOOK_OPERATION_IDS, paymentWebhookOperations,
);

interface CompatibilityRow {
  readonly current_user: string;
  readonly session_user: string;
  readonly role_safe: boolean;
  readonly writable: boolean;
  readonly schema: boolean;
  readonly contract: boolean;
  readonly relations: boolean;
  readonly functions: boolean;
  readonly selected_privileges: boolean;
  readonly forbidden_privileges: boolean;
}

export interface PaymentWebhookApiRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly telemetry: Telemetry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createPaymentWebhookApiRuntime(
  environment: PaymentWebhookApiEnvironment,
): Promise<PaymentWebhookApiRuntime> {
  const secrets = new WorkloadSecretStore(
    required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const [connection, applicationSource, paymentSource] = await Promise.all([
    secrets.read(required(environment.DATABASE_API_CONNECTION_REF, 'DATABASE_API_CONNECTION_REF_MISSING')),
    secrets.read(required(environment.WECHAT_APPLICATION_CONFIG_REF, 'WECHAT_APPLICATION_CONFIG_REF_MISSING')),
    secrets.read(required(environment.WECHAT_PAYMENT_CONFIG_REF, 'WECHAT_PAYMENT_CONFIG_REF_MISSING')),
  ]);
  const gateway = new WechatGateway(
    WechatApplicationCatalog.parse(parseSecret(applicationSource, 'WECHAT_APPLICATION_CONFIG_INVALID')),
    parseSecret(paymentSource, 'WECHAT_PAYMENT_CONFIG_INVALID') as unknown as ConstructorParameters<typeof WechatGateway>[1],
  );
  const pool = createPool(connection, 'api');
  try {
    await assertPaymentWebhookRuntimeCompatibility(pool);
  } catch (cause) {
    await pool.end();
    throw cause;
  }
  const handlers = new Map<OperationId, import('../foundation/application/OperationHandler').OperationHandler>();
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const telemetry = commerceTelemetry();
  const audit = new RecordAudit(new PgAuditRepository());
  return Object.freeze({
    pool,
    extensions,
    telemetry,
    configure(container: Container) {
      container.bind(OPERATION_HANDLERS, handlers);
      container.bind(OPERATION_AUTHORIZER, {
        authorize: async () => { throw new Error('PAYMENT_WEBHOOK_AUTHORIZATION_FORBIDDEN'); },
      });
      container.bind(DATABASE_POOL, pool);
      container.bind(AUDIT_SINK, audit);
      container.bind(PAYMENT_GATEWAY, gateway);
    },
    async close() {
      await extensions.stop();
      await pool.end();
    },
  });
}

export async function paymentWebhookRuntimeCompatibility(pool: DatabasePool): Promise<Readonly<CompatibilityRow>> {
  const result = await pool.query<CompatibilityRow>(`select current_user,session_user,
    not exists(select 1 from pg_roles role where role.rolname=current_user
      and (role.rolsuper or role.rolcreatedb or role.rolcreaterole or role.rolinherit or role.rolreplication or role.rolbypassrls))
      and not exists(select 1 from pg_auth_members membership
        join pg_roles granted on granted.oid=membership.roleid join pg_roles member on member.oid=membership.member
        where granted.rolname=current_user or member.rolname=current_user) role_safe,
    not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1 and checksum=$2) schema,
    exists(select 1 from runtime.schemaversion where version=$3 and checksum=$4) contract,
    array_position(array[
      to_regclass('runtime.schemaversion'),to_regclass('runtime.job'),
      to_regclass('audit.record'),to_regclass('audit.accessrecord'),to_regclass('audit.archiveref'),
      to_regclass('payment.intent'),to_regclass('payment.intenttender'),to_regclass('payment.attempt'),
      to_regclass('payment.payment'),to_regclass('payment.refund'),to_regclass('payment.refundtender')
    ],null) is null relations,
    array_position(array[
      to_regprocedure('payment.webhook_scope(text,text,text)'),
      to_regprocedure('runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)')
    ],null) is null functions,
    has_table_privilege(current_user,'runtime.schemaversion','SELECT')
      and has_table_privilege(current_user,'runtime.job','INSERT')
      and not has_table_privilege(current_user,'runtime.job','SELECT,UPDATE,DELETE')
      and has_table_privilege(current_user,'audit.record','SELECT,INSERT')
      and not has_table_privilege(current_user,'audit.record','UPDATE,DELETE')
      and has_table_privilege(current_user,'audit.accessrecord','SELECT')
      and has_table_privilege(current_user,'audit.archiveref','SELECT')
      and has_table_privilege(current_user,'payment.intent','SELECT')
      and has_table_privilege(current_user,'payment.intenttender','SELECT')
      and has_table_privilege(current_user,'payment.attempt','SELECT')
      and has_table_privilege(current_user,'payment.payment','SELECT')
      and has_table_privilege(current_user,'payment.refund','SELECT')
      and has_table_privilege(current_user,'payment.refundtender','SELECT')
      and has_function_privilege(current_user,'payment.webhook_scope(text,text,text)','EXECUTE')
      and has_function_privilege(current_user,
        'runtime.accept_provider_webhook(text,text,text,jsonb,text,text,text,integer,jsonb)','EXECUTE') selected_privileges,
    not has_schema_privilege(current_user,'identity','USAGE')
      and not has_schema_privilege(current_user,'access','USAGE')
      and not has_schema_privilege(current_user,'ordering','USAGE')
      and not has_schema_privilege(current_user,'finance','USAGE')
      and not has_table_privilege(current_user,'runtime.rawenvelope','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'runtime.outbox','SELECT,INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.intent','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.intenttender','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.attempt','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.payment','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.refund','INSERT,UPDATE,DELETE')
      and not has_table_privilege(current_user,'payment.refundtender','INSERT,UPDATE,DELETE') forbidden_privileges`,
  [PAYMENT_WEBHOOK_SCHEMA_VERSION, PAYMENT_WEBHOOK_SCHEMA_CHECKSUM, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'zhudatuanpaymentwebhookapi' || state.session_user !== 'zhudatuanpaymentwebhookapi'
    || !state.role_safe || !state.writable || !state.schema || !state.contract || !state.relations || !state.functions
    || !state.selected_privileges || !state.forbidden_privileges) {
    throw new Error(`PAYMENT_WEBHOOK_RUNTIME_COMPATIBILITY_FAILED:${JSON.stringify(state ?? null)}`);
  }
  return Object.freeze(state);
}

export async function assertPaymentWebhookRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  await paymentWebhookRuntimeCompatibility(pool);
}

function paymentWebhookOperations(context: ModuleContext): OperationUsecase {
  const webhook = new PaymentWebhook(
    context.container.get(DATABASE_POOL).workload('command'),
    context.container.get(PAYMENT_GATEWAY),
    context.container.get(AUDIT_SINK),
  );
  return Object.freeze({
    async invoke(request: OperationRequest) {
      try {
        return await webhook.handle(request);
      } catch (cause) {
        throw providerProtocolError(cause);
      }
    },
  });
}

function providerProtocolError(cause: unknown): unknown {
  const code = cause instanceof Error && 'code' in cause && typeof cause.code === 'string' ? cause.code : '';
  if (!code.startsWith('WECHAT_PAY_')) return cause;
  if (code === 'WECHAT_PAY_SIGNATURE_HEADERS_MISSING') return new Error('PROVIDER_SIGNATURE_MISSING');
  if (code.startsWith('WECHAT_PAY_SIGNATURE_') || code === 'WECHAT_PAY_PLATFORM_KEY_ID_UNKNOWN') {
    return new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
  }
  return new Error('PROVIDER_WEBHOOK_BODY_INVALID');
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
