import { randomUUID } from 'node:crypto';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { providerLimit } from '@shop/providercore';
import type { OperationActions } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import type { InstallExtensionPort } from '../../../extension/public/index';
import { Connection, type ConnectionLimits } from '../../domain/model/Connection';

interface Preparation {
  readonly access: ReturnType<typeof requireAccess>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly secretRef: string | null;
}

export function createConnectionOperations(extensions: InstallExtensionPort): OperationActions {
  return {
    'channel.connections.create': operationLifecycle({
      prepare,
      execute: async (request, database, prepared) => {
        const provider = textField(prepared.body, 'provider', 64);
        requireMvpProvider(provider);
        const id = `connection:${randomUUID()}`;
        const region = required(prepared.configuration.region, 'PROVIDER_REGION_INVALID');
        const installed = await extensions.execute(database, {
          id,
          provider,
          scope: prepared.access.scope.id,
          baseUrl: optional(prepared.configuration.baseUrl),
          endpoints: stringMap(prepared.configuration.endpoints),
          secretRef: prepared.secretRef,
          healthOperation: required(prepared.configuration.healthOperation, 'PROVIDER_HEALTH_OPERATION_INVALID'),
          actor: prepared.access.actor.id,
          trace: prepared.access.trace,
        });
        const limits = connectionLimits(providerLimit(installed.manifest));
        new Connection(id, provider, prepared.access.scope.id, 'draft', region, limits, 0);
        const result = await database.query(
          `insert into channel.connection(id,provider,scope_id,status,contract_version,secret_ref,configuration,
          connection_timeout_ms,response_timeout_ms,total_deadline_ms,max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,
          region,version) values($1,$2,$3,'draft',$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,0)
          returning id,provider,scope_id,status,contract_version,region,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
          max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version,created_at,updated_at,
          secret_ref is not null has_secret`,
          [
            id,
            provider,
            prepared.access.scope.id,
            installed.manifest.contractVersion,
            prepared.secretRef,
            JSON.stringify(prepared.configuration),
            limits.connectionTimeoutMs,
            limits.responseTimeoutMs,
            limits.totalDeadlineMs,
            limits.maxConcurrency,
            limits.requestsPerSecond,
            limits.maxAttempts,
            limits.failureThreshold,
            limits.recoveryMs,
            region,
          ]
        );
        return rowResult(result, 201);
      },
    }),
    'channel.connections.update': operationLifecycle({
      prepare,
      execute: async (request, database, prepared) => {
        const id = request.input.path.connectionid!;
        await extensions.reconfigure(database, id, prepared.access.scope.id, {
          baseUrl: optional(prepared.configuration.baseUrl),
          endpoints: stringMap(prepared.configuration.endpoints),
          secretRef: prepared.secretRef,
          healthOperation: required(prepared.configuration.healthOperation, 'PROVIDER_HEALTH_OPERATION_INVALID'),
          actor: prepared.access.actor.id,
          trace: prepared.access.trace,
        });
        const result = await database.query(
          `update channel.connection set configuration=$3::jsonb,secret_ref=$4,region=$5,status='draft',
          version=version+1,updated_at=clock_timestamp() where id=$1 and scope_id=$2 and status in('draft','disabled')
          and ($6::bigint is null or version=$6)
          returning id,provider,scope_id,status,contract_version,region,connection_timeout_ms,response_timeout_ms,total_deadline_ms,
          max_concurrency,requests_per_second,max_attempts,failure_threshold,recovery_ms,version,created_at,updated_at,
          secret_ref is not null has_secret`,
          [id, prepared.access.scope.id, JSON.stringify(prepared.configuration), prepared.secretRef, required(prepared.configuration.region, 'PROVIDER_REGION_INVALID'), request.input.expectedVersion ?? null]
        );
        if (!result.rows[0]) throw new Error('VERSION_CONFLICT_OR_CONNECTION_ACTIVE');
        return rowResult(result);
      },
    }),
  };
}

async function prepare(request: OperationRequest): Promise<Preparation> {
  const access = requireAccess(request);
  const body = bodyRecord(request);
  const configuration = record(body.configuration);
  const secretRef = optional(body.secretRef);
  return Object.freeze({ access, body, configuration, secretRef });
}
function requireMvpProvider(provider: string): void {
  if (!REQUIRED_PROVIDER_IDS.includes(provider)) throw new Error('PROVIDER_NOT_MVP_LOADABLE');
}
function connectionLimits(value: ConnectionLimits): ConnectionLimits {
  return Object.freeze({ ...value });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}
function stringMap(value: unknown): Readonly<Record<string, string>> {
  const source = value === undefined ? {} : record(value);
  if (!Object.values(source).every((item) => typeof item === 'string' && item.trim())) throw new Error('PROVIDER_ENDPOINTS_INVALID');
  return Object.freeze(source as Record<string, string>);
}
function required(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
function optional(value: unknown): string | null {
  return value === undefined || value === null || value === '' ? null : required(value, 'VALIDATION_FAILED');
}
