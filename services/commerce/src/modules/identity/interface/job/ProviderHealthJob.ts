import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { MonitorIdentityProviders } from '../../application/process/MonitorIdentityProviders';

export class ProviderHealthJob implements JobProcessor {
  constructor(private readonly monitor: MonitorIdentityProviders) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'providerhealth') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    const requested = typeof payload.provider === 'string' ? payload.provider : null;
    return this.monitor.execute(requested, job.scope ?? 'identity', job.id, signal, deadline);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
