import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCurrentPageCsv, serializeCsv, timestampedCsvFilename, type CsvColumn } from './CurrentPageCsv';

interface Row {
  readonly name: string;
  readonly note: string;
  readonly nullable: null;
  readonly missing?: string;
}

const columns: readonly CsvColumn<Row>[] = [
  { header: '名称', value: (row) => row.name },
  { header: '备注', value: (row) => row.note },
  { header: '空值', value: (row) => row.nullable },
  { header: '缺失', value: (row) => row.missing },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('current-page CSV export', () => {
  it('serializes a BOM-prefixed CRLF document and escapes commas, quotes, line breaks, null and undefined', () => {
    const csv = serializeCsv([{ name: '福利,商品', note: '他说"好"\n下一行', nullable: null }], columns);

    expect(csv).toBe('\uFEFF名称,备注,空值,缺失\r\n"福利,商品","他说""好""\n下一行",,\r\n');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.match(/\r\n/g)).toHaveLength(2);
  });

  it('exports an empty page with only its header row', () => {
    expect(serializeCsv([], columns)).toBe('\uFEFF名称,备注,空值,缺失\r\n');
  });

  it('creates, clicks, removes and revokes a CSV download link', () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:current-page');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadCurrentPageCsv({
      rows: [{ name: '测试商品', note: '当前页', nullable: null }],
      columns,
      filename: 'products-current-page-20260831-123456.csv',
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('text/csv;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:current-page');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('formats a stable local timestamp in the download filename', () => {
    const date = new Date(2026, 7, 31, 5, 6, 7);
    expect(timestampedCsvFilename('orders-current-page', date)).toBe('orders-current-page-20260831-050607.csv');
  });
});
