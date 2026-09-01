import { CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM, TARGET_SCHEMA_HEAD, requiredValue, type JobsEnvironment } from '@shop/config/server';
import type { Job } from '../foundation/application/Job';
import { QueueJob } from '../foundation/infrastructure/QueueJob';
import { KmsClient } from '../foundation/infrastructure/KmsClient';
import { WorkloadSecretStore } from '../foundation/infrastructure/SecretStore';
import { createPool, type DatabasePool } from '../foundation/persistence/Pool';
import { JobMetrics } from '../foundation/telemetry/JobMetrics';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { DeliveryRegistry } from '../modules/notification/application/DeliveryRegistry';
import { DispatchNotification } from '../modules/notification/application/command/DispatchNotification';
import { AliyunSmsChannel } from '../modules/notification/infrastructure/adapter/AliyunSmsChannel';
import { parseIdentityNotificationConfiguration } from '../modules/notification/infrastructure/adapter/IdentityNotificationConfiguration';
import { PgNotificationRepository } from '../modules/notification/infrastructure/persistence/PgNotificationRepository';
import { IdentityNotificationBacklogMonitor } from '../modules/notification/interface/job/IdentityNotificationBacklogMonitor';
import { IdentityNotificationJobProcessor, type IdentityChallengeDispatcher } from '../modules/notification/interface/job/NotificationJob';
import { assertIdentityRuntimeDatabaseBoundary } from './LiveDatabaseBoundary';

export interface IdentityNotificationJobsRuntime {
  readonly job: Job<void>;
  readonly backlog: IdentityNotificationBacklogMonitor;
  close(): Promise<void>;
}

export async function createIdentityNotificationJobsRuntime(environment: JobsEnvironment): Promise<IdentityNotificationJobsRuntime> {
  const secrets = new WorkloadSecretStore(
    requiredValue(environment.SECRET_STORE_ENDPOINT, 'SECRET_STORE_ENDPOINT_MISSING'),
    requiredValue(environment.SECRET_STORE_BEARER_TOKEN, 'SECRET_STORE_BEARER_TOKEN_MISSING'),
  );
  const connection = await secrets.read(requiredValue(environment.DATABASE_JOB_CONNECTION_REF, 'DATABASE_JOB_CONNECTION_REF_MISSING'));
  const pool = createPool(connection, 'jobs');
  try {
    await assertIdentityNotificationRuntimeCompatibility(pool);
    const [configurationSource] = await Promise.all([
      secrets.read(requiredValue(environment.IDENTITY_NOTIFICATION_CONFIG_REF, 'IDENTITY_NOTIFICATION_CONFIG_REF_MISSING')),
    ]);
    const configuration = parseIdentityNotificationConfiguration(configurationSource);
    const kms = new KmsClient(
      requiredValue(environment.KMS_ENDPOINT, 'KMS_ENDPOINT_MISSING'),
      requiredValue(environment.KMS_BEARER_TOKEN, 'KMS_BEARER_TOKEN_MISSING'),
    );
    const deliveries = new DeliveryRegistry([new AliyunSmsChannel(configuration.sms)]);
    const dispatches = new DispatchNotification(new PgNotificationRepository(pool), kms, deliveries);
    const telemetry = commerceTelemetry();
    return Object.freeze({
      job: createIdentityNotificationJob(pool, dispatches, requiredValue(environment.JOB_WORKER_ID, 'JOB_WORKER_ID_MISSING'),
        new JobMetrics(telemetry)),
      backlog: new IdentityNotificationBacklogMonitor(pool, telemetry),
      close: () => pool.end(),
    });
  } catch (cause) {
    await pool.end().catch(() => undefined);
    throw cause;
  }
}

export function createIdentityNotificationJob(pool: DatabasePool, dispatches: IdentityChallengeDispatcher, worker: string,
  metrics?: JobMetrics): Job<void> {
  return new QueueJob('identitynotification', pool, {
    worker,
    owner: 'identity',
    batch: 20,
    poll: 1_000,
    lease: 30,
    concurrency: 16,
    attempts: 8,
    claim: 'identity-notification',
    deadline: 15_000,
    retryMinimum: 250,
    retryMaximum: 60_000,
  }, new IdentityNotificationJobProcessor(dispatches), undefined, metrics);
}

export async function assertIdentityNotificationRuntimeCompatibility(pool: DatabasePool): Promise<void> {
  const result = await pool.query<{
    current_user: string;
    writable: boolean;
    schema: boolean;
    contract: boolean;
    registration: boolean;
    runtime_job: boolean;
    challenge: boolean;
    challenge_secret: boolean;
    challenge_delivery: boolean;
  }>(`select current_user,not pg_is_in_recovery() writable,
    exists(select 1 from runtime.schemaversion where version=$1) schema,
    exists(select 1 from runtime.schemaversion where version=$2 and checksum=$3) contract,
    exists(select 1 from runtime.schemaversion where version='20260828170000'
      and checksum='5cf87482ba3d0db32500809d28a77973ac285657aeb9c14612ba3dc525a2965e') registration,
    to_regclass('runtime.job') is not null runtime_job,
    to_regclass('identity.challenge') is not null challenge,
    to_regclass('identity.challengesecret') is not null challenge_secret,
    to_regclass('identity.challengedelivery') is not null challenge_delivery`,
  [TARGET_SCHEMA_HEAD, CONTRACT_SCHEMA_HEAD, RUNTIME_CONTRACT_CHECKSUM]);
  const state = result.rows[0];
  if (!state || state.current_user !== 'zhudatuanidentityjob' || !state.writable || !state.schema || !state.contract || !state.registration || !state.runtime_job
    || !state.challenge || !state.challenge_secret || !state.challenge_delivery) {
    throw new Error('IDENTITY_NOTIFICATION_RUNTIME_COMPATIBILITY_FAILED');
  }
  await assertIdentityRuntimeDatabaseBoundary(pool, 'zhudatuanidentityjob');
}
