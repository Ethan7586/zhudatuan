import { IMPORT_CAPACITY } from '@shop/config/runtime';
import type { BatchImportProcessPort, ImportOwner } from '../../public/ImportProcess';
import { importCode, importDetail } from '../../domain/value/Failure';
import type { ImportFilePort } from '../port/ImportFilePort';

export class RunImport {
  constructor(
    private readonly owner: ImportOwner,
    private readonly files: ImportFilePort,
    private readonly process: BatchImportProcessPort,
    private readonly limits: Readonly<{ bytes: number; rows: number }> = Object.freeze({ bytes: IMPORT_CAPACITY.maximumFileBytes, rows: IMPORT_CAPACITY.maximumRows })
  ) {}

  async execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (signal.aborted) throw signal.reason;
    const execution = Object.freeze({ scope, signal, deadline });
    const target = await this.process.find(id, execution);
    if (!target || ['completed', 'failed', 'cancelled', 'expired'].includes(target.state)) return;
    try {
      await this.process.authorize(target, execution);
      let state = target.state;
      if (state === 'uploaded' || state === 'validating') {
        const rows = this.files.read(target.reference, target.sha256, this.limits.bytes, this.limits.rows);
        await this.process.stage(target, rows, execution);
        await this.publishPreflightFailures(target, execution);
        return;
      }
      if (state === 'ready' && !target.confirmed) {
        await this.publishPreflightFailures(target, execution);
        return;
      }
      if (state === 'ready' || state === 'running') {
        if (!(await this.process.process(target, signal, deadline))) return;
        state = 'reporting';
      }
      if (state !== 'reporting') throw new Error('IMPORT_STATE_INVALID');
      const report = await this.files.report(this.owner, target.id, await this.process.failures(target, execution));
      await this.process.complete(target, report, execution);
    } catch (cause) {
      const code = importCode(cause, 'IMPORT_PROCESSING_FAILED');
      const detail = importDetail(cause);
      if (PERMANENT.has(code)) {
        await this.process.reject(target, code, detail, execution);
        return;
      }
      await this.process.fault(target, detail, execution);
      throw cause;
    }
  }

  private async publishPreflightFailures(target: Parameters<BatchImportProcessPort['failures']>[0], execution: Parameters<BatchImportProcessPort['failures']>[1]): Promise<void> {
    const failures = await this.process.failures(target, execution);
    if (failures.length === 0) return;
    await this.process.report(target, await this.files.report(this.owner, target.id, failures), execution);
  }
}

const PERMANENT = new Set([
  'IMPORT_OBJECT_INVALID',
  'IMPORT_HASH_MISMATCH',
  'IMPORT_FILE_EMPTY',
  'CSV_ROW_LIMIT_EXCEEDED',
  'CSV_QUOTE_UNTERMINATED',
  'CSV_HEADER_INVALID',
  'CSV_COLUMN_COUNT_INVALID',
  'CSV_COLUMNS_CHANGED',
  'XLSX_ARCHIVE_INVALID',
  'XLSX_ARCHIVE_ENTRY_FORBIDDEN',
  'XLSX_COMPRESSION_LIMIT_EXCEEDED',
  'XLSX_WORKSHEET_COUNT_INVALID',
  'XLSX_COLUMN_LIMIT_EXCEEDED',
  'XLSX_ROW_LIMIT_EXCEEDED',
  'XLSX_HEADER_INVALID',
  'XLSX_COLUMN_COUNT_INVALID',
  'XLSX_CELL_INVALID',
  'XLSX_FORMULA_FORBIDDEN',
  'FINANCE_IMPORT_PROVIDER_REQUIRED',
  'FINANCE_IMPORT_PARTNER_REQUIRED',
  'FINANCE_IMPORT_PERIOD_INVALID',
  'FINANCE_IMPORT_CURRENCY_REQUIRED',
  'FINANCE_IMPORT_CURRENCY_UNSUPPORTED',
  'FINANCE_IMPORT_OPENING_INVALID',
  'FINANCE_IMPORT_CLOSING_INVALID',
  'FINANCE_STATEMENT_DUPLICATE',
  'FINANCE_RECONCILIATION_DUPLICATE',
  'FINANCE_IMPORT_ROW_COUNT_MISMATCH',
  'FINANCE_IMPORT_REFERENCE_DUPLICATE',
]);
