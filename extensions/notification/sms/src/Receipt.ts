import { createHash } from 'node:crypto';

export type SmsProviderReceipt =
  | Readonly<{ kind: 'delivery'; id: string; provider: 'aliyun'; externalId: string; recipientToken: string; state: 'delivered' | 'failed'; occurredAt: string; errorCode: string | null }>
  | Readonly<{ kind: 'optout'; id: string; provider: 'aliyun'; recipientToken: string; occurredAt: string; keyword: string }>;

export function parseSmsProviderReceipt(value: unknown, optOutKeywords: readonly string[]): SmsProviderReceipt {
  const source = record(value);
  const phone = phoneNumber(source.phone_number);
  const recipientToken = digest(phone);
  if (typeof source.content === 'string') {
    const keyword = source.content.trim().toUpperCase();
    if (!optOutKeywords.includes(keyword)) throw new Error('ALIYUN_SMS_UPSTREAM_UNSUPPORTED');
    const occurredAt = timestamp(source.send_time);
    return Object.freeze({ kind: 'optout', id: receiptId('optout', recipientToken, occurredAt, keyword), provider: 'aliyun', recipientToken, occurredAt, keyword });
  }
  if (typeof source.biz_id !== 'string' || !/^[A-Za-z0-9:_-]{4,128}$/.test(source.biz_id) || typeof source.success !== 'boolean') throw new Error('ALIYUN_SMS_RECEIPT_INVALID');
  const occurredAt = timestamp(source.report_time);
  const errorCode = source.success ? null : safeCode(source.err_code);
  return Object.freeze({
    kind: 'delivery', id: receiptId('delivery', recipientToken, occurredAt, source.biz_id), provider: 'aliyun', externalId: source.biz_id,
    recipientToken, state: source.success ? 'delivered' : 'failed', occurredAt, errorCode,
  });
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('ALIYUN_SMS_RECEIPT_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function phoneNumber(value: unknown): string {
  if (typeof value !== 'string' || !/^\+?[1-9]\d{5,19}$/.test(value)) throw new Error('ALIYUN_SMS_RECEIPT_INVALID');
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string') throw new Error('ALIYUN_SMS_RECEIPT_INVALID');
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('ALIYUN_SMS_RECEIPT_INVALID');
  return new Date(parsed).toISOString();
}

function safeCode(value: unknown): string {
  if (typeof value !== 'string') return 'ALIYUN_SMS_DELIVERY_FAILED';
  const normalized = value.toUpperCase().replace(/[^A-Z0-9_.-]/g, '').slice(0, 80);
  return normalized ? `ALIYUN_SMS_${normalized}` : 'ALIYUN_SMS_DELIVERY_FAILED';
}

function receiptId(kind: string, recipient: string, occurredAt: string, evidence: string): string {
  return `smsreceipt:${createHash('sha256').update(`${kind}\u0000${recipient}\u0000${occurredAt}\u0000${evidence}`).digest('hex')}`;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
