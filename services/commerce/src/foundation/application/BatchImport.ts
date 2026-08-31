import type { ClaimedJob, JobProcessor } from './JobRunner';
import { importCode, importDetail, importId, readImportFile, saveImportReport, type ImportFailure } from '../infrastructure/ImportFile';
import type { ObjectStore, StoredObject } from '../infrastructure/ObjectStore';

export type ImportState = 'uploaded' | 'validating' | 'ready' | 'running' | 'reporting' | 'completed' | 'failed' | 'cancelled';
export interface ImportTarget {
  readonly id: string;
  readonly scope: string;
  readonly reference: string;
  readonly sha256: string;
  readonly state: ImportState;
}

export interface BatchImportPort {
  find(id: string): Promise<ImportTarget | null>;
  stage(target: ImportTarget, rows: readonly Readonly<Record<string, string>>[]): Promise<void>;
  process(target: ImportTarget, signal: AbortSignal): Promise<boolean>;
  failures(target: ImportTarget): Promise<readonly ImportFailure[]>;
  complete(target: ImportTarget, report: StoredObject): Promise<void>;
  reject(target: ImportTarget, code: string, detail: string): Promise<void>;
  fault(target: ImportTarget, detail: string): Promise<void>;
}

export class BatchImportProcessor implements JobProcessor {
  constructor(
    private readonly kind: 'catalogimport' | 'inventoryimport' | 'memberimport' | 'voucherimport',
    private readonly owner: 'catalog' | 'inventory' | 'member' | 'voucher',
    private readonly objects: ObjectStore,
    private readonly port: BatchImportPort
  ) {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const id = importId(job.payload, `${this.kind.toUpperCase()}_REQUIRED`);
    const target = await this.port.find(id);
    if (!target || ['completed', 'failed', 'cancelled'].includes(target.state)) return;
    try {
      let state = target.state;
      if (state === 'uploaded' || state === 'validating') {
        const rows = await readImportFile(this.objects, target.reference, target.sha256);
        if (rows.length === 0) throw new Error('IMPORT_FILE_EMPTY');
        await this.port.stage(target, rows);
        state = 'ready';
      }
      if (state === 'ready' || state === 'running') {
        if (!(await this.port.process(target, signal))) return;
        state = 'reporting';
      }
      if (state !== 'reporting') throw new Error('IMPORT_STATE_INVALID');
      const report = await saveImportReport(this.objects, this.owner, target.id, await this.port.failures(target));
      await this.port.complete(target, report);
    } catch (cause) {
      const code = importCode(cause, 'IMPORT_PROCESSING_FAILED');
      const detail = importDetail(cause);
      if (PERMANENT.has(code)) {
        await this.port.reject(target, code, detail);
        return;
      }
      await this.port.fault(target, detail);
      throw cause;
    }
  }
}

const PERMANENT = new Set(['IMPORT_OBJECT_INVALID', 'IMPORT_HASH_MISMATCH', 'IMPORT_FILE_EMPTY', 'CSV_ROW_LIMIT_EXCEEDED', 'CSV_QUOTE_UNTERMINATED', 'CSV_HEADER_INVALID', 'CSV_COLUMN_COUNT_INVALID']);
