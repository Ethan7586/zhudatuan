import { createHash } from 'node:crypto';
import type { JsonObject, JsonValue, ProviderWebhookRequest, ProviderWebhookVerifier } from '@shop/contract';
import { createCakeuncleAuth, type CakeuncleCredential } from './Auth';
import { verifyCakeuncleSignature } from './Signer';

export class CakeuncleWebhookVerifier implements ProviderWebhookVerifier {
  private readonly credential: CakeuncleCredential;

  constructor(secret: Readonly<Record<string, string>>, private readonly toleranceMs = 300_000,
    private readonly maximumBodyBytes = 65_536) {
    this.credential = createCakeuncleAuth(secret);
  }

  verify(_context: unknown, request: ProviderWebhookRequest): Promise<boolean> {
    if (Buffer.byteLength(request.body, 'utf8') > this.maximumBodyBytes) return Promise.resolve(false);
    const value = parse(request.body);
    if (!value) return Promise.resolve(false);
    const channelNo = string(value.channel_no);
    const timestamp = string(value.timestamp);
    const signature = string(value.sign);
    if (channelNo !== this.credential.channelNo || !timestamp || !signature) return Promise.resolve(false);
    const milliseconds = timestamp.length === 10 ? Number(timestamp) * 1_000 : Number(timestamp);
    const received = Date.parse(request.receivedAt);
    if (!Number.isSafeInteger(milliseconds) || !Number.isFinite(received) || Math.abs(received - milliseconds) > this.toleranceMs) {
      return Promise.resolve(false);
    }
    return Promise.resolve(verifyCakeuncleSignature(channelNo, this.credential.channelKey, timestamp, signature));
  }

  normalize(request: ProviderWebhookRequest): JsonObject {
    if (Buffer.byteLength(request.body, 'utf8') > this.maximumBodyBytes) throw new Error('CAKEUNCLE_WEBHOOK_BODY_TOO_LARGE');
    const value = parse(request.body);
    if (!value) throw new Error('CAKEUNCLE_WEBHOOK_BODY_INVALID');
    const eventType = inferEventType(value);
    const reference = referenceOf(value);
    const payloadHash = createHash('sha256').update(stable(withoutAuth(value))).digest('hex');
    return Object.freeze({ eventType, authoritative: false, payloadHash,
      ...(reference ? { externalReference: reference } : {}),
      ...(value.status === undefined ? {} : { state: stateOf(value.status) }) });
  }
}

export const CAKEUNCLE_WEBHOOK_SUCCESS = Object.freeze({ code: 200, message: 'success' } as const);

/** Stable gateway header value for protocols that do not publish an event id. */
export function deriveCakeuncleEventId(body: string): string {
  const value = parse(body);
  if (!value) throw new Error('CAKEUNCLE_WEBHOOK_BODY_INVALID');
  return `cakeuncle:${createHash('sha256').update(stable(withoutAuth(value))).digest('hex')}`;
}

function inferEventType(value: JsonObject): string {
  if (Array.isArray(value.refund_all)) return 'meal.refund';
  if (value.take_infos !== undefined) return 'meal.pickup';
  if (value.order_no !== undefined || value.out_order_no !== undefined || value.order_code !== undefined) return 'order.status';
  if (value.cities !== undefined) return 'catalog.cities';
  if (value.specs !== undefined || Array.isArray(value.data)) return 'catalog.price';
  if (value.id !== undefined && value.status !== undefined) return 'catalog.status';
  return 'cakeuncle.update';
}

function referenceOf(value: JsonObject): string | undefined {
  for (const candidate of [value.out_order_no, value.order_code, value.order_no, value.id]) {
    const result = string(candidate);
    if (result) return result;
  }
  return undefined;
}

function stateOf(value: JsonValue): string {
  const status = String(value);
  return ({ '0': 'pending', '1': 'accepted', '2': 'completed', '3': 'cancelled', '4': 'cancelled_refunded',
    '7': 'cancelled_unpaid' } as Readonly<Record<string, string>>)[status] ?? status;
}

function withoutAuth(value: JsonObject): JsonObject {
  return Object.freeze(Object.fromEntries(Object.entries(value).filter(([key]) => !['channel_no', 'timestamp', 'sign'].includes(key))) as JsonObject);
}

function stable(value: JsonValue): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

function parse(body: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(body);
    return isJsonObject(value) ? value : null;
  } catch { return null; }
}

function string(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value) ||
    (Array.isArray(value) && value.every(isJsonValue)) || isJsonObject(value);
}
