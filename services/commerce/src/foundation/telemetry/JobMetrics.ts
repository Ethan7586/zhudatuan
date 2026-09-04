import type { Telemetry } from '@shop/telemetry';
import type { ClaimedJob } from '../../modules/runtime/public/JobProcess';
import { failureLog } from './FailureLog';

export class JobMetrics {
  constructor(private readonly telemetry: Telemetry) {}
  failure(job: ClaimedJob, owner: string, cause: unknown): void {
    const correlationId = correlation(job.payload);
    void this.telemetry.logger.write({
      requestId: job.id,
      traceId: trace(job.payload) ?? job.id,
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(job.scope === null ? {} : { scopeId: job.scope }),
      module: owner,
      job: job.kind,
      attempt: job.attempts,
      level: 'error',
      event: 'commerce.job.failure',
      data: failureLog(cause),
    });
  }
  observe(job: ClaimedJob, owner: string, milliseconds: number, outcome: 'success' | 'retry' | 'deadletter' | 'cancelled', errorCode?: string): void {
    const correlationId = correlation(job.payload);
    const context = {
      requestId: job.id,
      traceId: trace(job.payload) ?? job.id,
      ...(correlationId === undefined ? {} : { correlationId }),
      ...(job.scope === null ? {} : { scopeId: job.scope }),
      module: owner,
      job: job.kind,
      attempt: job.attempts,
      result: outcome,
      durationMs: milliseconds,
      ...(errorCode === undefined ? {} : { errorCode }),
    };
    this.telemetry.metrics.count('commerce.job.count', 1, context);
    this.telemetry.metrics.duration('commerce.job.duration', milliseconds, context);
  }
}

function trace(payload: unknown): string | undefined {
  return field(payload, 'traceId') ?? field(payload, 'trace');
}
function correlation(payload: unknown): string | undefined {
  return field(payload, 'correlationId') ?? field(payload, 'correlation');
}
function field(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const value = Reflect.get(payload, key);
  return typeof value === 'string' && value ? value : undefined;
}
