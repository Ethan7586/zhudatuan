import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { exportHeader } from '../../domain/model/ExportJob';
import { PgReportingRepository } from '../../infrastructure/persistence/PgReportingRepository';

const PAGE_SIZE = 1000;

export class ExportJobRunner implements JobProcessor {
  constructor(private readonly pool: DatabasePool, private readonly objects: ObjectStore, private readonly maximumAttempts: number) {
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1) throw new Error('REPORT_EXPORT_ATTEMPTS_INVALID');
  }

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'export') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const id = text(object(job.payload).export, 'REPORT_EXPORT_REQUIRED');
    const repository = new PgReportingRepository(this.pool);
    const selected = await repository.claimExport(id);
    if (!selected) return;
    const upload = await this.objects.create(`reports/${id.replaceAll(':', '/')}.csv`, 'text/csv');
    try {
      await upload.append(encode(`${exportHeader(selected.report).map(csv).join(',')}\n`));
      let cursor = selected.cursor;
      for (;;) {
        if (signal.aborted) throw signal.reason;
        const page = await repository.exportRows(id, selected.report, cursor, PAGE_SIZE);
        if (page.length === 0) break;
        const lines: string[] = [];
        for (const row of page) { cursor = row.key; lines.push(row.values.map(csv).join(',')); }
        await upload.append(encode(`${lines.join('\n')}\n`));
        await repository.advanceExport(id, cursor!, page.length);
      }
      const stored = await upload.complete();
      const verified = await this.objects.inspect(stored.reference);
      if (verified.scan !== 'clean' || verified.sha256 !== stored.sha256 || verified.size !== stored.size || verified.contentType !== 'text/csv') {
        throw new Error('REPORT_EXPORT_SCAN_OR_INTEGRITY_FAILED');
      }
      await repository.completeExport(id, stored);
    } catch (cause) {
      await upload.abort();
      const code = cause instanceof Error ? cause.message.slice(0, 200) : 'REPORT_EXPORT_FAILED';
      await repository.failExport(id, code, job.attempts >= this.maximumAttempts);
      throw cause;
    }
  }
}

function csv(value: unknown): string {
  const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"','""')}"` : safe;
}
function encode(value: string): Uint8Array { return new TextEncoder().encode(value); }
function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
