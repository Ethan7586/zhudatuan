import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import ExcelJS from 'exceljs';
import { exportFormat, exportHeader } from '../../02_domain_yewu/model/ExportJob';
import { PgReportingRepository } from '../../04_adapters_shixian/persistence/PgReportingRepository';

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
    const format = exportFormat(selected.filter);
    const contentType = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
    const filename = exportFilename(selected.filter, format);
    const upload = await this.objects.create(`reports/${id.replaceAll(':', '/')}/${filename}`, contentType);
    try {
      const header = exportHeader(selected.report, selected.filter);
      const workbookRows: unknown[][] = [];
      if (format === 'csv') await upload.append(encode(`${serializeCsvRow(header)}\n`));
      let cursor = selected.cursor;
      for (;;) {
        if (signal.aborted) throw signal.reason;
        const page = await repository.exportRows(id, selected.report, selected.filter, cursor, PAGE_SIZE);
        if (page.length === 0) break;
        for (const row of page) { cursor = row.key; workbookRows.push([...row.values]); }
        if (format === 'csv') {
          await upload.append(encode(`${page.map((row) => serializeCsvRow(row.values)).join('\n')}\n`));
          workbookRows.length = 0;
        }
        await repository.advanceExport(id, cursor!, page.length);
      }
      if (format === 'xlsx') await upload.append(await createXlsxDocument(header, workbookRows));
      const stored = await upload.complete();
      const verified = await this.objects.inspect(stored.reference);
      if (verified.scan !== 'clean' || verified.sha256 !== stored.sha256 || verified.size !== stored.size || verified.contentType !== contentType) {
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
export function serializeCsvRow(values: readonly unknown[]): string { return values.map(csv).join(','); }
function encode(value: string): Uint8Array { return new TextEncoder().encode(value); }
export async function createXlsxDocument(header: readonly string[], rows: readonly unknown[][]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('订单');
  sheet.addRow([...header]);
  rows.forEach((row) => sheet.addRow(row.map(excelValue)));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1649A8' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  sheet.columns.forEach((column) => { column.width = 20; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
function excelValue(value: unknown): ExcelJS.CellValue {
  if (value === null || value === undefined) return '';
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}
function exportFilename(filter: Readonly<Record<string, unknown>>, format: 'csv' | 'xlsx'): string {
  const requested = typeof filter.filename === 'string' ? filter.filename.trim().replace(/\.(csv|xlsx)$/i, '') : '';
  const safe = requested.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || '订单导出';
  return `${safe}.${format}`;
}
function object(value: unknown): Record<string, unknown> { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('JOB_PAYLOAD_INVALID'); return value as Record<string, unknown>; }
function text(value: unknown, code: string): string { if (typeof value !== 'string' || !value) throw new Error(code); return value; }
