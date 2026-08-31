import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const input = await FileBlob.load('/Users/changshengwang/Workspace/zhudatuan/docs/福利商城功能清单.xlsx');
const workbook = await SpreadsheetFile.importXlsx(input);
const result = await workbook.inspect({
  kind: 'table',
  range: 'MVP上线功能清单!A1:F24',
  include: 'values,formulas',
  tableMaxRows: 30,
  tableMaxCols: 8,
  maxChars: 30000,
});

process.stdout.write(`${result.ndjson}\n`);
