import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { MonitorExtensions } from '../../application/process/MonitorExtensions';

export class ExtensionHealthJob implements JobProcessor {
  constructor(private readonly monitor: MonitorExtensions) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'extensionhealth') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload);
    if (payload.scan === true) return this.monitor.scan(signal, deadline);
    return this.monitor.check(text(payload.installation, 'EXTENSION_INSTALLATION_REQUIRED'), text(job.scope_id, 'EXTENSION_SCOPE_REQUIRED'), job.id, signal, deadline);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}
