import { describe, expect, it } from 'vitest';
<<<<<<< HEAD
import { zipSync } from 'fflate';
import { Workbook, sharedStrings, worksheet } from './WorkbookReader';
=======
import { sharedStrings, worksheet } from './WorkbookReader';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

describe('WorkbookReader', () => {
  it('keeps self-closing sparse cells from consuming the next cell', () => {
    const xml = '<row><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"/><c r="C3" t="s"><v>1</v></c></row>';
    expect(Object.fromEntries(worksheet(xml, ['平台层', '分销层']))).toEqual({ A3: '平台层', B3: '', C3: '分销层' });
  });

  it('joins rich shared strings and decodes XML entities', () => {
    const xml = '<sst><si><r><t>卡券</t></r><r><t xml:space="preserve">\n&amp;福利</t></r></si><si><t>商城&#10;首页</t></si></sst>';
    expect(sharedStrings(xml)).toEqual(['卡券\n&福利', '商城\n首页']);
  });
<<<<<<< HEAD

  it('reports a stable error when an evidence sheet is absent', () => {
    const workbook = new Workbook(fixtureWorkbook());
    expect(() => workbook.range('Missing', 'A1')).toThrow('XLSX_SHEET_MISSING:Missing');
  });

  it('reports a stable error when an evidence cell is absent or blank', () => {
    const workbook = new Workbook(fixtureWorkbook());
    expect(() => workbook.range('Orders', 'B2')).toThrow('XLSX_CELL_MISSING:Orders!B2');
  });

  it('reports a stable error for an invalid evidence range', () => {
    const workbook = new Workbook(fixtureWorkbook());
    expect(() => workbook.range('Orders', 'B2:A1')).toThrow('XLSX_RANGE_INVALID:Orders!B2:A1');
  });
});

function fixtureWorkbook(): Uint8Array {
  const encode = (value: string): Uint8Array => new TextEncoder().encode(value);
  return zipSync({
    'xl/workbook.xml': encode('<workbook><sheets><sheet name="Orders" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': encode('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': encode('<sst><si><t>订单</t></si></sst>'),
    'xl/worksheets/sheet1.xml': encode('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>'),
  });
}
=======
});
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
