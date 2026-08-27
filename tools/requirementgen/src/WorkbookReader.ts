<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
import { strFromU8, unzipSync } from 'fflate';

export interface WorkbookCell {
  readonly reference: string;
  readonly value: string;
}

export class Workbook {
  readonly #archive: Readonly<Record<string, Uint8Array>>;
  readonly #shared: readonly string[];
  readonly #sheetPaths: ReadonlyMap<string, string>;
  readonly #sheets = new Map<string, Map<string, string>>();

  constructor(bytes: Uint8Array) {
    this.#archive = unzipSync(bytes);
    this.#shared = sharedStrings(this.#xml('xl/sharedStrings.xml'));
    const relationships = new Map<string, string>();
    for (const match of this.#xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*?)(?:\/>|>)/g)) {
      const id = /\bId="([^"]+)"/.exec(match[1]!)?.[1];
      const target = /\bTarget="([^"]+)"/.exec(match[1]!)?.[1];
      if (id && target) relationships.set(id, target);
    }
    const paths = new Map<string, string>();
    for (const match of this.#xml('xl/workbook.xml').matchAll(/<sheet\b([^>]*?)(?:\/>|>)/g)) {
      const name = /\bname="([^"]+)"/.exec(match[1]!)?.[1];
      const relationship = /\br:id="([^"]+)"/.exec(match[1]!)?.[1];
      const target = relationship === undefined ? undefined : relationships.get(relationship);
      if (name && target) paths.set(decodeXml(name), target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, ''));
    }
    this.#sheetPaths = paths;
  }

  sheetNames(): readonly string[] {
    return Object.freeze([...this.#sheetPaths.keys()]);
  }

  maxRow(name: string): number {
    const path = this.#sheetPaths.get(name);
    if (!path) throw new Error('XLSX_SHEET_MISSING:' + name);
    const dimension = /<dimension\b[^>]*\bref="(?:[A-Z]+\d+:)?[A-Z]+(\d+)"/.exec(this.#xml(path))?.[1];
    if (dimension !== undefined) return Number(dimension);
    const rows = [...this.#sheet(name).keys()].map((reference) => Number(/\d+$/.exec(reference)?.[0] ?? 0));
    return Math.max(0, ...rows);
  }

  range(sheet: string, range: string): readonly WorkbookCell[] {
    const match = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(range);
    if (!match) throw new Error('XLSX_RANGE_INVALID:' + sheet + '!' + range);
    const startColumn = columnNumber(match[1]!);
    const startRow = Number(match[2]);
    const endColumn = columnNumber(match[3] ?? match[1]!);
    const endRow = Number(match[4] ?? match[2]);
    if (startColumn > endColumn || startRow > endRow) throw new Error('XLSX_RANGE_INVALID:' + sheet + '!' + range);
    const cells = this.#sheet(sheet);
    const result: WorkbookCell[] = [];
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const reference = columnName(column) + String(row);
        const value = cells.get(reference) ?? '';
        if (value) result.push(Object.freeze({ reference, value }));
      }
    }
    if (result.length === 0) throw new Error('XLSX_CELL_MISSING:' + sheet + '!' + range);
    return Object.freeze(result);
  }

  #sheet(name: string): Map<string, string> {
    const path = this.#sheetPaths.get(name);
    if (!path) throw new Error('XLSX_SHEET_MISSING:' + name);
    const cached = this.#sheets.get(name);
    if (cached) return cached;
    const cells = worksheet(this.#xml(path), this.#shared);
    this.#sheets.set(name, cells);
    return cells;
  }

  #xml(path: string): string {
    const bytes = this.#archive[path];
    if (!bytes) throw new Error('XLSX_ENTRY_MISSING:' + path);
    return strFromU8(bytes);
  }
}

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export function sharedStrings(source: string): readonly string[] {
  return [...source.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1]!.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]!)).join('').trim());
}

export function worksheet(source: string, strings: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of source.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = match[1]!;
    const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
    if (!reference) continue;
    const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
    const body = match[2] ?? '';
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      ?? [...body.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => text[1]!).join('');
    result.set(reference, type === 's' ? (raw === '' ? '' : strings[Number(raw)] ?? '') : decodeXml(raw).trim());
  }
  return result;
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, '&');
}
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)

function columnNumber(value: string): number {
  return [...value].reduce((result, character) => result * 26 + character.charCodeAt(0) - 64, 0);
}

function columnName(value: number): string {
  let current = value;
  let result = '';
  while (current > 0) {
    current -= 1;
    result = String.fromCharCode(65 + current % 26) + result;
    current = Math.floor(current / 26);
  }
  return result;
}
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> b9d67316 (feat(requirements): add OMS requirement trace)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
