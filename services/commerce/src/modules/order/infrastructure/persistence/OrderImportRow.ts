import { createHash } from 'node:crypto';
import { PROVIDER_REQUIREMENTS } from '@shop/contract';
import { OrderAddress, type OrderAddressSnapshot } from '../../domain/model/OrderAddress';
import { OrderLine, type OrderLineSnapshot } from '../../domain/model/OrderLine';

const sources = new Set(['offline', ...PROVIDER_REQUIREMENTS.map(({ id }) => id)]);
const states = new Set(['unpaid', 'paid', 'fulfilled', 'completed', 'refunded', 'cancelled']);

export interface OrderImportValue {
  readonly source: string;
  readonly externalOrderNo: string;
  readonly mall: string;
  readonly member: string;
  readonly orderedAt: string;
  readonly currency: string;
  readonly state: string;
  readonly totalMinor: number;
  readonly paymentReference: string | null;
  readonly statementReference: string | null;
  readonly address: OrderAddressSnapshot | null;
  readonly lines: readonly OrderLineSnapshot[];
}

export function orderImportValue(row: Readonly<Record<string, string>>, now = Date.now()): OrderImportValue {
  const source = required(row.source, 'ORDER_IMPORT_CHANNEL_REQUIRED', 64).toLowerCase();
  if (!sources.has(source)) throw new Error('ORDER_IMPORT_CHANNEL_INVALID');
  const externalOrderNo = required(row.externalOrderNo, 'ORDER_IMPORT_EXTERNAL_NUMBER_REQUIRED', 160);
  const mall = required(row.mall, 'ORDER_IMPORT_MALL_REQUIRED', 160);
  const member = required(row.member, 'ORDER_IMPORT_MEMBER_REQUIRED', 160);
  const orderedAt = iso(row.orderedAt, 'ORDER_IMPORT_TIME_INVALID');
  if (new Date(orderedAt).getTime() > now + 300_000) throw new Error('ORDER_IMPORT_TIME_INVALID');
  const currency = (row.currency || 'CNY').toUpperCase();
  if (currency !== 'CNY') throw new Error('ORDER_IMPORT_CURRENCY_UNSUPPORTED');
  const state = (row.state || 'unpaid').toLowerCase();
  if (!states.has(state)) throw new Error('ORDER_IMPORT_STATE_INVALID');
  const lines = Object.freeze(linesOf(row).map((line, index) => OrderLine.freeze({ ...line, id: `source:${index + 1}` }).value));
  const lineTotal = lines.reduce((sum, line) => sum + line.payableMinor, 0);
  if (!Number.isSafeInteger(lineTotal)) throw new Error('ORDER_IMPORT_AMOUNT_INVALID');
  const totalMinor = row.totalMinor ? amount(row.totalMinor, 'ORDER_IMPORT_AMOUNT_INVALID') : lineTotal;
  if (lineTotal !== totalMinor) throw new Error('ORDER_IMPORT_AMOUNT_MISMATCH');
  return Object.freeze({
    source,
    externalOrderNo,
    mall,
    member,
    orderedAt,
    currency,
    state,
    totalMinor,
    paymentReference: optional(row.paymentReference, 256),
    statementReference: optional(row.statementReference, 256),
    address: addressOf(row.address),
    lines,
  });
}

function linesOf(row: Readonly<Record<string, string>>): readonly Omit<OrderLineSnapshot, 'id'>[] {
  if (row.lines) return parsedLines(row.lines);
  return [lineOf(row, 1)];
}

function parsedLines(value: string): readonly Omit<OrderLineSnapshot, 'id'>[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('ORDER_IMPORT_LINES_INVALID'); }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 100) throw new Error('ORDER_IMPORT_LINES_INVALID');
  return parsed.map((line, index) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) throw new Error('ORDER_IMPORT_LINES_INVALID');
    return lineOf(Object.fromEntries(Object.entries(line).map(([key, item]) => [key, String(item ?? '')])), index + 1);
  });
}

function lineOf(row: Readonly<Record<string, string>>, sequence: number): Omit<OrderLineSnapshot, 'id'> {
  const quantity = positive(row.quantity, 'ORDER_IMPORT_QUANTITY_INVALID');
  const unitMinor = amount(row.unitMinor, 'ORDER_IMPORT_UNIT_INVALID');
  const totalMinor = unitMinor * quantity;
  if (!Number.isSafeInteger(totalMinor)) throw new Error('ORDER_IMPORT_AMOUNT_INVALID');
  const discountMinor = row.discountMinor ? amount(row.discountMinor, 'ORDER_IMPORT_DISCOUNT_INVALID') : 0;
  if (discountMinor > totalMinor) throw new Error('ORDER_IMPORT_DISCOUNT_INVALID');
  const listing = required(row.listing, 'ORDER_IMPORT_LISTING_REQUIRED', 160);
  const sku = required(row.sku, 'ORDER_IMPORT_SKU_REQUIRED', 160);
  const provider = optional(row.provider, 64);
  if (provider && !sources.has(provider)) throw new Error('ORDER_IMPORT_CHANNEL_INVALID');
  return Object.freeze({
    sku,
    listing,
    product: optional(row.product, 160) ?? listing,
    productType: optional(row.productType, 32) ?? 'physical',
    category: optional(row.category, 128) ?? 'external',
    title: required(row.title, 'ORDER_IMPORT_TITLE_REQUIRED', 300),
    quantity,
    unitMinor,
    totalMinor,
    discountMinor,
    payableMinor: totalMinor - discountMinor,
    provider,
    partner: optional(row.partner, 160),
    versions: Object.freeze({ listing: 0, product: 0, sku: 0, price: `external:${sequence}`, stock: 0 }),
  });
}

function addressOf(value: string | undefined): OrderAddressSnapshot | null {
  if (!value) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('ORDER_IMPORT_ADDRESS_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('ORDER_IMPORT_ADDRESS_INVALID');
  const source = parsed as Readonly<Record<string, unknown>>;
  const snapshot = {
    recipientMasked: addressField(source.recipientMasked, 120),
    mobileMasked: addressField(source.mobileMasked, 40),
    addressMasked: addressField(source.addressMasked, 500),
    regionCode: addressField(source.regionCode, 32),
    version: 'external:1',
  };
  return OrderAddress.freeze({ ...snapshot, hash: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') }).value;
}

function addressField(value: unknown, maximum: number): string {
  if (typeof value !== 'string') throw new Error('ORDER_IMPORT_ADDRESS_INVALID');
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > maximum) throw new Error('ORDER_IMPORT_ADDRESS_INVALID');
  return normalized;
}

function required(value: string | undefined, code: string, maximum: number): string {
  const normalized = value?.normalize('NFKC').trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}
function optional(value: string | undefined, maximum: number): string | null {
  const normalized = value?.normalize('NFKC').trim();
  if (!normalized) return null;
  if (normalized.length > maximum) throw new Error('ORDER_IMPORT_FIELD_TOO_LONG');
  return normalized;
}
function amount(value: string | undefined, code: string): number {
  if (value === undefined || !/^(0|[1-9][0-9]{0,14})$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}
function positive(value: string | undefined, code: string): number {
  const parsed = amount(value, code);
  if (parsed <= 0) throw new Error(code);
  return parsed;
}
function iso(value: string | undefined, code: string): string {
  if (!value) throw new Error(code);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}
