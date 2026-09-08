import type { ProviderWorkerEnvironment } from '@shop/config/server';
import { createPool, DATABASE_POOL, type DatabasePool } from '../platform/database/Pool';
import { QueryMetrics, QUERY_METRICS } from '../platform/database/QueryMetrics';
import { KMS_CLIENT } from '../pipeline/KmsPort';
import { HttpKmsClient } from '../platform/crypto/KmsClient';
import { secretText, SECRET_STORE, WorkloadSecretStore } from '../platform/secret/SecretStore';
import { commerceTelemetry, TELEMETRY } from '../platform/telemetry/Telemetry';
import { EXTENSION_LOADER } from '../modules/extension/application/port/ExtensionLoader';
import { EXTENSION_REGISTRY, ExtensionRegistry } from './ExtensionRegistry';
import { extensionLoader } from '../modules/extension/infrastructure/loader/ExtensionBootstrap';
import { MANIFEST_VERIFIER, SignatureVerifier } from './SignatureVerifier';
import type { Container } from './Container';
import { LOG_SINK } from '../modules/observability/application/port/LogSink';
import { METRIC_SINK } from '../modules/observability/application/port/MetricSink';
import { TRACE_SINK } from '../modules/observability/application/port/TraceSink';
import { TelemetryLogSink, TelemetryMetricSink, TelemetryTraceSink } from '../modules/observability/infrastructure/adapter/TelemetrySinks';

export interface ProviderRuntime {
  readonly pool: DatabasePool;
  readonly extensions: ExtensionRegistry;
  readonly configure: (container: Container) => void;
  close(): Promise<void>;
}

export async function createProviderRuntime(environment: ProviderWorkerEnvironment): Promise<ProviderRuntime> {
  const secrets = new WorkloadSecretStore(required(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'), required(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'));
  const connection = await secretText(secrets, required(environment.DATABASE_PROVIDER_CONNECTION_REF, 'DATABASE_PROVIDER_CONNECTION_REF_MISSING'), 'database');
  const metrics = new QueryMetrics();
  const pool = createPool(connection, 'jobs', metrics);
  const role = await pool.query<{ current_user: string }>('select current_user');
  if (role.rows[0]?.current_user !== 'shopprovider') {
    await pool.end();
    throw new Error('DATABASE_ROLE_INVALID:shopprovider');
  }
  const verifier = new SignatureVerifier(await secretText(secrets, required(environment.EXTENSION_MANIFEST_KEY_REF, 'EXTENSION_MANIFEST_KEY_REF_MISSING'), 'manifest'));
  const extensions = new ExtensionRegistry(verifier);
  const loader = await extensionLoader(pool, secrets, extensions);
  const kms = new HttpKmsClient(required(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'), required(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'));
  const telemetry = commerceTelemetry();
  return Object.freeze({
    pool,
    extensions,
    configure(container: Container) {
      container.bind(DATABASE_POOL, pool);
      container.bind(QUERY_METRICS, metrics);
      container.bind(SECRET_STORE, secrets);
      container.bind(KMS_CLIENT, kms);
      container.bind(TELEMETRY, telemetry);
      container.bind(METRIC_SINK, new TelemetryMetricSink(telemetry));
      container.bind(TRACE_SINK, new TelemetryTraceSink(telemetry));
      container.bind(LOG_SINK, new TelemetryLogSink(telemetry));
      container.bind(MANIFEST_VERIFIER, verifier);
      container.bind(EXTENSION_REGISTRY, extensions);
      container.bind(EXTENSION_LOADER, loader);
    },
    async close() {
      await extensions.stop();
      await pool.end();
    },
  });
}

function required(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}
