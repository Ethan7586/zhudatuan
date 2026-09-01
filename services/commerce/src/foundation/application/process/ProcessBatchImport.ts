import type { BatchImportProcessPort } from '../BatchImport';
import { importCode, importDetail, readImportFile, saveImportReport } from '../../infrastructure/ImportFile';
import type { ObjectStore } from '../../infrastructure/ObjectStore';

export type BatchImportOwner = 'catalog' | 'inventory' | 'member' | 'voucher';

export class ProcessBatchImport {
  constructor(
    private readonly owner: BatchImportOwner,
    private readonly objects: ObjectStore,
    private readonly process: BatchImportProcessPort
  ) {}

  async execute(id: string, scope: string, signal: AbortSignal, deadline: number): Promise<void> {
    if (signal.aborted) throw signal.reason;
    const execution = Object.freeze({ scope, signal, deadline });
    const target = await this.process.find(id, execution);
    if (!target || ['completed', 'failed', 'cancelled'].includes(target.state)) return;
    try {
      let state = target.state;
      if (state === 'uploaded' || state === 'validating') {
        const rows = await readImportFile(this.objects, target.reference, target.sha256);
        if (rows.length === 0) throw new Error('IMPORT_FILE_EMPTY');
        await this.process.stage(target, rows, execution);
        state = 'ready';
      }
      if (state === 'ready' || state === 'running') {
        if (!(await this.process.process(target, signal, deadline))) return;
        state = 'reporting';
      }
      if (state !== 'reporting') throw new Error('IMPORT_STATE_INVALID');
      const report = await saveImportReport(this.objects, this.owner, target.id, await this.process.failures(target, execution));
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
}

const PERMANENT = new Set(['IMPORT_OBJECT_INVALID', 'IMPORT_HASH_MISMATCH', 'IMPORT_FILE_EMPTY', 'CSV_ROW_LIMIT_EXCEEDED', 'CSV_QUOTE_UNTERMINATED', 'CSV_HEADER_INVALID', 'CSV_COLUMN_COUNT_INVALID']);
