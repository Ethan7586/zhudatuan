export interface CsvColumn<Row> {
  readonly header: string;
  readonly value: (row: Row) => unknown;
}

export interface DownloadCurrentPageCsvOptions<Row> {
  readonly rows: readonly Row[];
  readonly columns: readonly CsvColumn<Row>[];
  readonly filename: string;
}

const UTF8_BOM = '\uFEFF';

export function serializeCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(',')),
  ];
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}

export function downloadCurrentPageCsv<Row>({ rows, columns, filename }: DownloadCurrentPageCsvOptions<Row>): void {
  const blob = new Blob([serializeCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

export function timestampedCsvFilename(prefix: string, date = new Date()): string {
  const timestamp = [
    date.getFullYear(),
    twoDigits(date.getMonth() + 1),
    twoDigits(date.getDate()),
    '-',
    twoDigits(date.getHours()),
    twoDigits(date.getMinutes()),
    twoDigits(date.getSeconds()),
  ].join('');
  return `${prefix}-${timestamp}.csv`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
