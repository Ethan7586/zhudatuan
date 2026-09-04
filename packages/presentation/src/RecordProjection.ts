import { chineseDomainLabel } from './ChineseDomain';

export interface DisplayRow {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly timestamp: string;
}

export interface DisplayCollection {
  readonly rows: readonly DisplayRow[];
  readonly count: number;
  readonly nextCursor: string | null;
}

const titleKeys = ['title', 'name', 'label', 'number', 'order_number', 'sku', 'external_id'] as const;
const detailKeys = ['provider', 'mall_name', 'product_name', 'subject_type', 'purpose', 'reason', 'description'] as const;
const statusKeys = ['status', 'state', 'result', 'health_state', 'payment_state', 'fulfillment_state'] as const;
const timestampKeys = ['updated_at', 'created_at', 'placed_at', 'attempted_at', 'checked_at'] as const;

export function projectRecords(value: unknown): DisplayCollection {
  const page = record(value);
  const source = Array.isArray(page?.items) ? page.items : page ? [page] : [];
  const rows = source.map((item, index) => projectRecord(item, index));
  const count = typeof page?.count === 'number' && Number.isSafeInteger(page.count) && page.count >= rows.length ? page.count : rows.length;
  const nextCursor = typeof page?.nextCursor === 'string' ? page.nextCursor : null;
  return Object.freeze({ rows: Object.freeze(rows), count, nextCursor });
}

function projectRecord(value: unknown, index: number): DisplayRow {
  const item = record(value) ?? {};
  const identity = first(item, ['id', 'number', 'external_id']) || `row-${index + 1}`;
  const title = first(item, titleKeys) || `业务记录 ${index + 1}`;
  return Object.freeze({
    key: identity,
    title,
    detail: first(item, detailKeys) || shortReference(identity),
    status: chineseDomainLabel(first(item, statusKeys), '已同步'),
    timestamp: first(item, timestampKeys),
  });
}

function first(source: Readonly<Record<string, unknown>>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function shortReference(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : undefined;
}
