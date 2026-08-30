import { SystemClock } from '@shop/kernel';
import type { Telemetry } from '@shop/telemetry';
import type { ApiEnvironment } from '@shop/config/server';
import type { OperationId } from '@shop/contract';
import { AccessPipeline } from '../foundation/security/AccessPipeline';
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
import { PgDecisionSink } from '../modules/access/infrastructure/persistence/PgDecisionSink';
import { RiskCheckAdapter } from '../modules/risk/infrastructure/persistence/RiskCheckAdapter';
import { RISK_GATE } from '../foundation/security/RiskGate';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { RecordAudit } from '../modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { commerceTelemetry, TELEMETRY } from '../foundation/telemetry/Telemetry';

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
  const role = await pool.query<{ current_user: string }>('select current_user');
  if (role.rows[0]?.current_user !== 'shopconsole') {
    await pool.end();
    throw new Error('DATABASE_ROLE_INVALID:shopconsole');
  }
  const extensions = new ExtensionRegistry({ verify: async () => false });
  const telemetry = commerceTelemetry();
  const risk = new RiskCheckAdapter(pool);
  const audit = new RecordAudit(new PgAuditRepository());
  const access = new AccessPipeline(new PgSessionResolver(pool), new PgMembershipResolver(pool), new PgAccessVersionResolver(pool),
    new PgScopeResolver(pool), new PgCapabilityResolver(pool), new SystemClock(), risk, new PgDecisionSink(pool));
  const handlers = new Map<OperationId, OperationHandler>();
  const kms = new KmsClient(
    required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
    required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'),
  );
  return {
    pool, extensions, telemetry,
    configure(container) {
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

function required(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  return value;
}
