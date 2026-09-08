import { randomUUID } from 'node:crypto';
import { Money, type CurrencyCode } from '@shop/kernel';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ProviderPrice } from '../../public/ProviderPrice';
import { Offer } from '../../domain/model/Offer';
import { PriceBook } from '../../domain/model/PriceBook';
import { Quote } from '../../domain/model/Quote';
import { PricingEngine } from '../../domain/service/PricingEngine';
import { PgPricingReadPort } from './PgPricingReadPort';
import { PgPriceWriter } from './PgPriceWriter';

export function nullableMinor(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('PROVIDER_PRICE_INVALID');
  return Number(value);
}
export function nullableTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('PROVIDER_PRICE_TIME_INVALID');
  return value;
}
export function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('PRICING_QUOTE_LINES_INVALID');
  return Object.freeze([...value]);
}
export function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRICING_QUOTE_OBJECT_INVALID');
  return Object.freeze({ ...(value as Record<string, unknown>) });
}
export function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
