import { safeErrorCode } from '../../../../foundation/domain/SafeError';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import { exportHeader } from '../../domain/model/ExportJob';
import type { ReportingJobRepository } from '../port/ReportingJobRepository';

const PAGE_SIZE = 1000;

export interface ReportExportExecution {
  readonly scope: string;
  readonly trace: string;
  readonly attempts: number;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class ExportReport {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ReportingJobRepository,
    private readonly objects: ObjectStore,
    private readonly maximumAttempts: number
  ) {
    if (!Number.isSafeInteger(maximumAttempts) || maximumAttempts < 1) throw new Error('REPORT_EXPORT_ATTEMPTS_INVALID');
  }

  async execute(id: string, execution: ReportExportExecution): Promise<void> {
    const options = this.options(execution);
    const selected = await this.transactions.write(options, (context) => this.repository.claimExport(context, id));
    if (!selected) return;
    const upload = await this.objects.create(`reports/${id.replaceAll(':', '/')}.csv`, 'text/csv');
    try {
      await upload.append(encode(`${exportHeader(selected.report).map(csv).join(',')}\n`));
      let cursor = selected.cursor;
      for (;;) {
        if (execution.signal.aborted) throw execution.signal.reason;
        const page = await this.transactions.read(options, (context) => this.repository.exportRows(context, id, selected.report, cursor, PAGE_SIZE));
        if (page.length === 0) break;
        const lines: string[] = [];
        for (const row of page) {
          cursor = row.key;
          lines.push(row.values.map(csv).join(','));
        }
        await upload.append(encode(`${lines.join('\n')}\n`));
        await this.transactions.write(options, (context) => this.repository.advanceExport(context, id, cursor!, page.length));
      }
      const stored = await upload.complete();
      const verified = await this.objects.inspect(stored.reference);
      if (verified.scan !== 'clean' || verified.sha256 !== stored.sha256 || verified.size !== stored.size || verified.contentType !== 'text/csv') {
        throw new Error('REPORT_EXPORT_SCAN_OR_INTEGRITY_FAILED');
      }
      await this.transactions.write(options, (context) => this.repository.completeExport(context, id, stored));
    } catch (cause) {
      await upload.abort();
      const code = safeErrorCode(cause, 'REPORT_EXPORT_FAILED');
      await this.transactions.write(options, (context) => this.repository.failExport(context, id, code, execution.attempts >= this.maximumAttempts));
      throw cause;
    }
  }

  private options(execution: ReportExportExecution): TransactionOptions {
    return {
      tenant: execution.scope,
      membership: '',
      scope: execution.scope,
      actor: 'job:export',
      trace: execution.trace,
      operation: 'job.reporting.export',
      workload: 'jobs',
      signal: execution.signal,
      deadline: execution.deadline,
    };
  }
}

function csv(value: unknown): string {
  const raw = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
