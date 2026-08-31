import { literal, null as nullSchema, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, isoUtc, pageOutput, pageQuery, unsigned } from './Primitives';

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
});
export const PAYMENT_BODY_SCHEMAS = {
  PaymentRefundsRequestInput: strictObject({ payment: string(), amountMinor: unsigned, reason: string() }),
  PaymentRecoveriesResolveInput: strictObject({ action: literal(['replay', 'requery', 'retryrefund', 'resolve']), reason: string() }),
  // Provider notifications are authorized from the untouched raw payload and
  // signature headers; the parsed operation body is deliberately empty.
  PaymentWebhooksWechatInput: strictObject({}),
} as const;

export const PAYMENT_QUERY_SCHEMAS = {
  PaymentIntentsReadInput: strictObject({}),
  PaymentRecoveriesReadInput: strictObject(pageQuery),
} as const;

export const PAYMENT_OUTPUT_SCHEMAS = {
  PaymentIntentsReadOutput: union([
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal('captured'), action: nullSchema(), expiresAt: isoUtc }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal('pending'), action: record(string(), string()), expiresAt: isoUtc }),
    strictObject({ intentId: string(), orderId: string(), paymentId: string(), state: literal(['preparing', 'recovery', 'failed', 'expired']), action: nullSchema(), expiresAt: isoUtc, retryAfter: unsigned }),
  ]),
  PaymentRefundsRequestOutput: refund,
  PaymentRecoveriesReadOutput: pageOutput(recovery),
  PaymentRecoveriesResolveOutput: strictObject({ case: string(), request: string(), action: literal(['replay', 'requery', 'retryrefund', 'resolve']), state: literal(['resolved', 'accepted']) }),
  PaymentWebhooksWechatOutput: strictObject({}),
} as const;
