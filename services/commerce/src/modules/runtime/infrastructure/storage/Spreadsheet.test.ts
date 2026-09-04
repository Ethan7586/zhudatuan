import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseSpreadsheet } from './Spreadsheet';

describe('Runtime spreadsheet parser', () => {
  it('projects one bounded worksheet into import rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('商品');
    sheet.addRow(['sku', 'title', 'enabled']);
    sheet.addRow(['SKU-1', '商品一', true]);
    const rows = await collect(parseSpreadsheet(new Uint8Array(await workbook.xlsx.writeBuffer()), 10));
    expect(rows).toEqual([{ sku: 'SKU-1', title: '商品一', enabled: 'true' }]);
  });

  it('rejects formulas and multiple populated worksheets', async () => {
    const formula = new ExcelJS.Workbook();
    formula.addWorksheet('导入').addRows([['sku', 'value'], ['SKU-1', { formula: '1+1', result: 2 }]]);
    await expect(collect(parseSpreadsheet(new Uint8Array(await formula.xlsx.writeBuffer()), 10))).rejects.toThrow('XLSX_FORMULA_FORBIDDEN');

    const multiple = new ExcelJS.Workbook();
    multiple.addWorksheet('一').addRow(['sku']);
    multiple.addWorksheet('二').addRow(['sku']);
    await expect(collect(parseSpreadsheet(new Uint8Array(await multiple.xlsx.writeBuffer()), 10))).rejects.toThrow('XLSX_WORKSHEET_COUNT_INVALID');
  });
});

async function collect(source: AsyncIterable<Readonly<Record<string, string>>>) {
  const values = [];
  for await (const value of source) values.push(value);
  return values;
}
