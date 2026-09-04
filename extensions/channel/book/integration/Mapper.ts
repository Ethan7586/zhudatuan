import type { JsonObject, JsonValue } from '@shop/contract';
import { CanonicalSourceMapper } from '@shop/providercore';

export class BookMapper extends CanonicalSourceMapper {
  override objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return super.objects(value.map((record) => canonical(record)), code);
  }
}

export function normalizeIsbn(value: string): string {
  const isbn = value.replaceAll('-', '').replaceAll(' ', '');
  if (!/^(?:\d{9}[\dX]|97[89]\d{10})$/.test(isbn) || !validIsbn(isbn)) throw new Error('BOOK_ISBN_INVALID');
  return isbn;
}

function canonical(value: JsonValue): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('BOOK_RECORD_INVALID');
  const source = value as JsonObject;
  if (source.externalId !== undefined) return source;
  const kind = source.kind;
  if (kind !== 'single' && kind !== 'set') throw new Error('BOOK_KIND_INVALID');
  const presaleAt = source.presaleAt;
  if (presaleAt !== null && presaleAt !== undefined && (typeof presaleAt !== 'string' || !Number.isFinite(Date.parse(presaleAt)))) throw new Error('BOOK_PRESALE_INVALID');
  return Object.freeze({
    externalId: normalizeIsbn(text(source.isbn, 'BOOK_ISBN_INVALID')),
    version: text(source.updatedAt, 'BOOK_VERSION_INVALID'),
    payload: Object.freeze({ publisher: text(source.publisher, 'BOOK_PUBLISHER_INVALID'), kind, presaleAt: presaleAt ?? null, stock: integer(source.stock, 'BOOK_STOCK_INVALID'), priceMinor: integer(source.priceCent, 'BOOK_PRICE_INVALID') }),
  });
}

function validIsbn(isbn: string): boolean {
  if (isbn.length === 10) return [...isbn].reduce((sum, character, index) => sum + (character === 'X' ? 10 : Number(character)) * (10 - index), 0) % 11 === 0;
  return [...isbn].reduce((sum, character, index) => sum + Number(character) * (index % 2 === 0 ? 1 : 3), 0) % 10 === 0;
}

function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function integer(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}
