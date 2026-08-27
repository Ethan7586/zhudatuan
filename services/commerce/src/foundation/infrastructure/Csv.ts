export function parseCsv(bytes: Uint8Array, maximumRows: number): readonly Readonly<Record<string, string>>[] {
<<<<<<< HEAD
  return parseCsvDocument(bytes, maximumRows).rows;
}

export interface CsvDocument {
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export function parseCsvDocument(bytes: Uint8Array, maximumRows: number): CsvDocument {
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
<<<<<<< HEAD
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += character;
    if (rows.length > maximumRows) throw new Error('CSV_ROW_LIMIT_EXCEEDED');
  }
  if (quoted) throw new Error('CSV_QUOTE_UNTERMINATED');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift()?.map((value) => value.trim());
  if (!headers?.length || headers.some((value) => !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)) || new Set(headers).size !== headers.length) throw new Error('CSV_HEADER_INVALID');
  const records = Object.freeze(
    rows
      .filter((values) => values.some((value) => value.trim()))
      .map((values) => {
        if (values.length !== headers.length) throw new Error('CSV_COLUMN_COUNT_INVALID');
        return Object.freeze(Object.fromEntries(headers.map((header, index) => [header, values[index]!.trim()])));
      })
  );
  return Object.freeze({ headers: Object.freeze(headers), rows: records });
=======
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += character;
    if (rows.length > maximumRows) throw new Error('CSV_ROW_LIMIT_EXCEEDED');
  }
  if (quoted) throw new Error('CSV_QUOTE_UNTERMINATED');
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift()?.map((value) => value.trim());
  if (!headers?.length || headers.some((value) => !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)) || new Set(headers).size !== headers.length) throw new Error('CSV_HEADER_INVALID');
  return Object.freeze(rows.filter((values) => values.some((value) => value.trim())).map((values) => {
    if (values.length !== headers.length) throw new Error('CSV_COLUMN_COUNT_INVALID');
    return Object.freeze(Object.fromEntries(headers.map((header, index) => [header, values[index]!.trim()])));
  }));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
