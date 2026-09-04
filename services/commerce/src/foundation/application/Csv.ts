/** Quote text and neutralize spreadsheet formula prefixes, including whitespace tricks. */
export function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
  const safe = /^\s*[=+\-@]|^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function parseCsv(bytes: Uint8Array, maximumRows: number): readonly Readonly<Record<string, string>>[] {
  assertMaximumRows(maximumRows);
  const parser = new CsvParser();
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const rows = [...parser.write(source), ...parser.finish()];
  const projector = new CsvProjector(maximumRows);
  const values = rows.flatMap((row) => projector.project(row));
  projector.complete();
  return Object.freeze(values);
}

export async function* parseCsvStream(chunks: AsyncIterable<Uint8Array>, maximumRows: number): AsyncIterable<Readonly<Record<string, string>>> {
  assertMaximumRows(maximumRows);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parser = new CsvParser();
  const projector = new CsvProjector(maximumRows);
  for await (const chunk of chunks) {
    for (const row of parser.write(decoder.decode(chunk, { stream: true }))) {
      for (const value of projector.project(row)) yield value;
    }
  }
  const tail = decoder.decode();
  for (const row of [...parser.write(tail), ...parser.finish()]) {
    for (const value of projector.project(row)) yield value;
  }
  projector.complete();
}

class CsvParser {
  private row: string[] = [];
  private field = '';
  private quoted = false;
  private pendingQuote = false;
  private beginning = true;

  write(source: string): readonly string[][] {
    const rows: string[][] = [];
    for (const sourceCharacter of source) {
      const character = this.beginning && sourceCharacter === '\uFEFF' ? '' : sourceCharacter;
      this.beginning = false;
      if (!character) continue;
      if (this.quoted) {
        if (this.pendingQuote) {
          if (character === '"') {
            this.field += '"';
            this.pendingQuote = false;
            continue;
          }
          this.quoted = false;
          this.pendingQuote = false;
        } else if (character === '"') {
          this.pendingQuote = true;
          continue;
        } else {
          this.field += character;
          continue;
        }
      }
      if (character === '"' && this.field.length === 0) this.quoted = true;
      else if (character === ',') this.pushField();
      else if (character === '\n') rows.push(this.pushRow());
      else this.field += character;
    }
    return rows;
  }

  finish(): readonly string[][] {
    if (this.quoted && !this.pendingQuote) throw new Error('CSV_QUOTE_UNTERMINATED');
    this.quoted = false;
    this.pendingQuote = false;
    return this.field.length > 0 || this.row.length > 0 ? [this.pushRow()] : [];
  }

  private pushField(): void {
    this.row.push(this.field.replace(/\r$/, ''));
    this.field = '';
  }

  private pushRow(): string[] {
    this.pushField();
    const row = this.row;
    this.row = [];
    return row;
  }
}

class CsvProjector {
  private headers: readonly string[] | null = null;
  private count = 0;

  constructor(private readonly maximumRows: number) {}

  project(values: readonly string[]): readonly Readonly<Record<string, string>>[] {
    if (this.headers === null) {
      this.headers = tabularHeaders(values, 'CSV_HEADER_INVALID');
      return [];
    }
    if (!values.some((value) => value.trim())) return [];
    this.count += 1;
    if (this.count > this.maximumRows) throw new Error('CSV_ROW_LIMIT_EXCEEDED');
    return [tabularRecord(this.headers, values, 'CSV_COLUMN_COUNT_INVALID')];
  }

  complete(): void {
    if (this.headers === null) throw new Error('CSV_HEADER_INVALID');
  }
}

export function tabularHeaders(values: readonly string[], code: string): readonly string[] {
  const headers = values.map((value) => value.trim());
  if (!headers.length || headers.some((value) => !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value)) || new Set(headers).size !== headers.length) throw new Error(code);
  return Object.freeze(headers);
}

export function tabularRecord(headers: readonly string[], values: readonly string[], code: string): Readonly<Record<string, string>> {
  if (values.length !== headers.length) throw new Error(code);
  return Object.freeze(Object.fromEntries(headers.map((header, index) => [header, values[index]!.trim()])));
}

function assertMaximumRows(maximumRows: number): void {
  if (!Number.isSafeInteger(maximumRows) || maximumRows < 1) throw new Error('CSV_ROW_LIMIT_INVALID');
}
