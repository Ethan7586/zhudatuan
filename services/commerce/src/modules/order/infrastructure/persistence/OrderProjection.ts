import { orderTime } from '../../application/model/OrderTime';

const timeFields = new Set(['orderedAt', 'receivedAt', 'createdAt', 'updatedAt', 'occurredAt', 'watermark', 'created_at', 'updated_at']);
const opaqueFields = new Set(['evidence', 'address_snapshot', 'invoice_snapshot', 'delivery_snapshot']);

export function orderProjection<T>(value: T): T {
  return normalize(value) as T;
}

function normalize(value: unknown, field?: string): unknown {
  if (field !== undefined && opaqueFields.has(field)) return value;
  if (value instanceof Date) return orderTime(value);
  if (field !== undefined && timeFields.has(field)) {
    if (value === null || typeof value === 'string') return orderTime(value);
    throw new Error('ORDER_PROJECTION_TIME_INVALID');
  }
  if (Array.isArray(value)) return Object.freeze(value.map((item) => normalize(item)));
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, key)])));
  }
  return value;
}
