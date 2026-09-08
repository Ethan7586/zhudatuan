import ExcelJS from 'exceljs';
import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { tabularHeaders, tabularRecord } from '../../../../pipeline/Csv';

export async function* parseSpreadsheet(bytes: Uint8Array, maximumRows: number): AsyncIterable<Readonly<Record<string, string>>> {
  validateArchive(bytes);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.slice().buffer as ArrayBuffer);
  const sheets = workbook.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (sheets.length !== 1) throw new Error('XLSX_WORKSHEET_COUNT_INVALID');
  const sheet = sheets[0]!;
  if (sheet.actualColumnCount < 1 || sheet.actualColumnCount > IMPORT_CAPACITY.maximumColumns) throw new Error('XLSX_COLUMN_LIMIT_EXCEEDED');
  let headers: readonly string[] | null = null;
  let count = 0;
  for (let index = 1; index <= sheet.rowCount; index += 1) {
    const row = sheet.getRow(index);
    if (!row.hasValues) continue;
    const values = Array.from({ length: sheet.actualColumnCount }, (_, column) => cellText(row.getCell(column + 1).value));
    if (headers === null) {
      headers = tabularHeaders(values, 'XLSX_HEADER_INVALID');
      continue;
    }
    if (!values.some((value) => value.trim())) continue;
    count += 1;
    if (count > maximumRows) throw new Error('XLSX_ROW_LIMIT_EXCEEDED');
    yield tabularRecord(headers, values, 'XLSX_COLUMN_COUNT_INVALID');
  }
  if (headers === null) throw new Error('XLSX_HEADER_INVALID');
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('XLSX_CELL_INVALID');
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if ('formula' in value || 'sharedFormula' in value) throw new Error('XLSX_FORMULA_FORBIDDEN');
  if ('error' in value) throw new Error('XLSX_CELL_INVALID');
  if ('richText' in value) return value.richText.map(({ text }) => text).join('');
  if ('text' in value) return value.text;
  throw new Error('XLSX_CELL_INVALID');
}

function validateArchive(bytes: Uint8Array): void {
  if (bytes.byteLength < 22 || bytes.byteLength > IMPORT_CAPACITY.maximumSpreadsheetBytes) throw new Error('XLSX_ARCHIVE_INVALID');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEnd(view);
  const entries = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (entries < 1 || entries > IMPORT_CAPACITY.maximumSpreadsheetEntries || directoryOffset + directorySize > end) throw new Error('XLSX_ARCHIVE_INVALID');
  let offset = directoryOffset;
  let compressed = 0;
  let expanded = 0;
  let worksheet = false;
  let workbook = false;
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('XLSX_ARCHIVE_INVALID');
    const flags = view.getUint16(offset + 8, true);
    const packed = view.getUint32(offset + 20, true);
    const unpacked = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if ((flags & 1) !== 0 || packed === 0xffffffff || unpacked === 0xffffffff || offset + 46 + nameLength + extraLength + commentLength > bytes.byteLength) {
      throw new Error('XLSX_ARCHIVE_INVALID');
    }
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name.startsWith('/') || name.includes('..') || name.includes('\\') || /(^|\/)(vbaProject\.bin|embeddings|externalLinks)(\/|$)/iu.test(name)) {
      throw new Error('XLSX_ARCHIVE_ENTRY_FORBIDDEN');
    }
    workbook ||= name === 'xl/workbook.xml';
    worksheet ||= /^xl\/worksheets\/sheet\d+\.xml$/u.test(name);
    compressed += packed;
    expanded += unpacked;
    if (expanded > IMPORT_CAPACITY.maximumExpandedBytes || (compressed > 0 && expanded / compressed > IMPORT_CAPACITY.maximumCompressionRatio)) {
      throw new Error('XLSX_COMPRESSION_LIMIT_EXCEEDED');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!workbook || !worksheet || offset !== directoryOffset + directorySize) throw new Error('XLSX_ARCHIVE_INVALID');
}

function findEnd(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('XLSX_ARCHIVE_INVALID');
}
