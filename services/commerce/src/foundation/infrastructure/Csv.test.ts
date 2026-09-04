import { describe, expect, it } from 'vitest';
import { csvCell, parseCsv, parseCsvStream } from '../application/Csv';

describe('shared CSV cell encoding', () => {
  it.each(['=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)', '  =1+1', '\t=1+1', '\r=1+1', '\n=1+1', '\u0000=1+1'])('neutralizes formula input %j', value => {
    expect(csvCell(value)).toMatch(/^"'/);
  });
  it('quotes delimiters, double quotes and multiline content without losing text', () => {
    expect(csvCell('普通文本,"引号"\n下一行')).toBe('"普通文本,""引号""\n下一行"');
    expect(csvCell('AbC0123456')).toBe('"AbC0123456"');
  });
  it('renders absent values as empty cells and retains integer precision', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(9007199254740991n)).toBe('"9007199254740991"');
  });
});

describe('streaming CSV parsing', () => {
  it('preserves UTF-8, escaped quotes and records split across arbitrary chunks', async () => {
    const source = new TextEncoder().encode('\uFEFFname,note\r\n张三,"跨\r\n行"\r\n李四,"a""b"\r\n');
    const rows = [];
    for await (const row of parseCsvStream(parts(source, [1, 2, 5, 11, 17, 23]), 2)) rows.push(row);
    expect(rows).toEqual([{ name: '张三', note: '跨\r\n行' }, { name: '李四', note: 'a"b' }]);
    expect(rows).toEqual(parseCsv(source, 2));
  });

  it('fails closed on row limits and an unterminated quoted value', async () => {
    await expect(collect(parseCsvStream(parts(new TextEncoder().encode('id\n1\n2\n'), [2]), 1))).rejects.toThrow('CSV_ROW_LIMIT_EXCEEDED');
    await expect(collect(parseCsvStream(parts(new TextEncoder().encode('id\n"open'), [4]), 1))).rejects.toThrow('CSV_QUOTE_UNTERMINATED');
  });
});

async function* parts(source: Uint8Array, boundaries: readonly number[]) {
  let offset = 0;
  for (const boundary of boundaries) {
    if (boundary <= offset || boundary >= source.byteLength) continue;
    yield source.slice(offset, boundary);
    offset = boundary;
  }
  if (offset < source.byteLength) yield source.slice(offset);
}

async function collect(source: AsyncIterable<Readonly<Record<string, string>>>) {
  const values = [];
  for await (const value of source) values.push(value);
  return values;
}
