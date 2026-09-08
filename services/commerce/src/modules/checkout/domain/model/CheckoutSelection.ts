import { DomainError } from '../../../../platform/error/DomainError';
import { RUNTIME_LIMITS } from '@shop/config/runtime';

export interface SelectedCartLine {
  readonly listingId: string;
  readonly quantity: number;
  readonly lineVersion: number;
}

export interface BenefitChoice {
  readonly accountId: string;
  readonly amountMinor: number;
}

export interface CheckoutSelection {
  readonly cartVersion: number;
  readonly lines: readonly SelectedCartLine[];
  readonly addressId: string | null;
  readonly invoiceId: string | null;
  readonly delivery: DeliveryChoice;
  readonly voucherIds: readonly string[];
  readonly benefits: readonly BenefitChoice[];
  readonly paymentScene: 'miniapp' | 'jsapi';
}

export interface DeliveryChoice {
  readonly method: 'standard' | 'express' | 'pickup' | 'digital';
  readonly note: string | null;
  readonly scheduledAt: string | null;
}

export function checkoutSelection(body: Readonly<Record<string, unknown>>): CheckoutSelection {
  const cartVersion = unsigned(body.cartVersion, 'cartVersion');
  const lines = selectedLines(body.lines);
  const addressId = optionalText(body.addressId, 'addressId');
  const invoiceId = optionalText(body.invoiceId, 'invoiceId');
  const voucherIds = textList(body.voucherIds, 'voucherIds', 20).sort();
  const benefits = benefitChoices(body.benefits).sort((left, right) => left.accountId.localeCompare(right.accountId));
  const delivery = deliveryChoice(body.delivery);
  const paymentScene = body.paymentScene;
  if (paymentScene !== 'miniapp' && paymentScene !== 'jsapi') throw new DomainError('VALIDATION_FAILED', { field: 'paymentScene' });
  return Object.freeze({ cartVersion, lines: Object.freeze(lines), addressId, invoiceId, delivery, voucherIds: Object.freeze(voucherIds), benefits: Object.freeze(benefits), paymentScene });
}

function selectedLines(value: unknown): SelectedCartLine[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > RUNTIME_LIMITS.cart.maximumLines) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
  const result = value.map((entry) => {
    if (!recordValue(entry)) throw new DomainError('VALIDATION_FAILED', { field: 'lines' });
    return Object.freeze({ listingId: requiredText(entry.listingId, 'lines.listingId'), quantity: positive(entry.quantity, 'lines.quantity'), lineVersion: unsigned(entry.lineVersion, 'lines.lineVersion') });
  });
  if (new Set(result.map(({ listingId }) => listingId)).size !== result.length) throw new DomainError('VALIDATION_FAILED', { field: 'lines.duplicate' });
  return result.sort((left, right) => left.listingId.localeCompare(right.listingId));
}

function benefitChoices(value: unknown): BenefitChoice[] {
  if (!Array.isArray(value) || value.length > 10) throw new DomainError('VALIDATION_FAILED', { field: 'benefits' });
  const result = value.map((entry) => {
    if (!recordValue(entry)) throw new DomainError('VALIDATION_FAILED', { field: 'benefits' });
    return Object.freeze({ accountId: requiredText(entry.accountId, 'benefits.accountId'), amountMinor: positive(entry.amountMinor, 'benefits.amountMinor') });
  });
  if (new Set(result.map(({ accountId }) => accountId)).size !== result.length) throw new DomainError('VALIDATION_FAILED', { field: 'benefits.duplicate' });
  return result;
}

function textList(value: unknown, field: string, maximum: number): string[] {
  if (!Array.isArray(value) || value.length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  const result = value.map((entry) => requiredText(entry, field));
  if (new Set(result).size !== result.length) throw new DomainError('VALIDATION_FAILED', { field: `${field}.duplicate` });
  return result;
}

function deliveryChoice(value: unknown): DeliveryChoice {
  if (!recordValue(value)) throw new DomainError('VALIDATION_FAILED', { field: 'delivery' });
  const allowed = new Set(['method', 'note', 'scheduledAt']);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new DomainError('VALIDATION_FAILED', { field: 'delivery' });
  const method = value.method ?? 'standard';
  if (!['standard', 'express', 'pickup', 'digital'].includes(String(method))) throw new DomainError('VALIDATION_FAILED', { field: 'delivery.method' });
  const note = optionalLimitedText(value.note, 'delivery.note', 200);
  const scheduledAt = optionalTime(value.scheduledAt);
  return Object.freeze({ method: method as DeliveryChoice['method'], note, scheduledAt });
}

function recordValue(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown, field: string): string | null {
  return value === undefined || value === null || value === '' ? null : requiredText(value, field);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 255) throw new DomainError('VALIDATION_FAILED', { field });
  return value.trim();
}

function optionalLimitedText(value: unknown, field: string, maximum: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  return value.trim();
}

function optionalTime(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED', { field: 'delivery.scheduledAt' });
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new DomainError('VALIDATION_FAILED', { field: 'delivery.scheduledAt' });
  return parsed.toISOString();
}

function unsigned(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DomainError('VALIDATION_FAILED', { field });
  return value as number;
}

function positive(value: unknown, field: string): number {
  const result = unsigned(value, field);
  if (result === 0) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}
