import { literal, null as nullSchema, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const nullableText = union([string(), nullSchema()]);
const refund = strictObject({
  id: string(),
  payment_id: string(),
  provider: literal(['wechat', 'internal', 'mixed']),
  provider_reference: string(),
  amount_minor: unsigned,
  currency,
  state: literal(['requested', 'processing', 'succeeded', 'failed', 'cancelled']),
  reason: string(),
  aftersale_id: nullableText,
});
const recovery = strictObject({
  id: string(),
  order_id: nullableText,
  order_number: nullableText,
  resource_type: string(),
  resource_id: string(),
  severity: literal(['high', 'critical']),
  state: literal(['open', 'resolved']),
  error_code: string(),
  evidence: ContractJsonValueSchema,
  occurrence_count: unsigned,
  opened_at: isoUtc,
  resolved_at: union([isoUtc, nullSchema()]),
  resolution_request_id: nullableText,
  version,
});
export const PAYMENT_BODY_SCHEMAS = {
  PaymentIntentsCreateInput: strictObject({ order: string(), scene: literal(['miniapp', 'jsapi']) }),
  PaymentRefundsRequestInput: strictObject({ payment: string(), amountMinor: unsigned, reason: string() }),
  PaymentRecoveriesResolveInput: strictObject({ action: literal(['replay', 'requery', 'retryrefund', 'resolve']), reason: string() }),
  // Provider notifications are authorized from the untouched raw payload and
  // signature headers; the parsed operation body is deliberately empty.
  PaymentWebhooksWechatInput: strictObject({}),
} as const;

export const PAYMENT_QUERY_SCHEMAS = {
  PaymentIntentsReadInput: strictObject({}),
  PaymentRecoveriesReadInput: strictObject({ ...pageQuery, orderId: optional(string()) }),
} as const;

export const PAYMENT_OUTPUT_SCHEMAS = {
  PaymentIntentsCreateOutput: union([
    strictObject({ intentId: string(), orderId: string(), paymentId: nullableText, state: literal('captured'), action: nullSchema(), expiresAt: isoUtc, retryAfter: literal(0) }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal('pending'), action: record(string(), string()), expiresAt: isoUtc, retryAfter: literal(0) }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal(['preparing', 'recovery', 'failed']), action: nullSchema(), expiresAt: isoUtc, retryAfter: unsigned }),
  ]),
  PaymentIntentsReadOutput: union([
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal('captured'), action: nullSchema(), expiresAt: isoUtc, retryAfter: literal(0) }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal('pending'), action: record(string(), string()), expiresAt: isoUtc, retryAfter: unsigned }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal(['preparing', 'recovery', 'failed', 'expired']), action: nullSchema(), expiresAt: isoUtc, retryAfter: unsigned }),
  ]),
  PaymentRefundsRequestOutput: refund,
  PaymentRecoveriesReadOutput: pageOutput(recovery),
  PaymentRecoveriesResolveOutput: strictObject({ case: string(), request: string(), action: literal(['replay', 'requery', 'retryrefund', 'resolve']), state: literal(['resolved', 'accepted']) }),
  PaymentWebhooksWechatOutput: strictObject({}),
} as const;
