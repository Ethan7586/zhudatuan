import type { Money } from '@shop/kernel';
import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';

export interface OrderLineSnapshot {
  readonly sku: string;
  readonly listing: string;
  readonly product: string;
  readonly productType: string;
  readonly category: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly versions: Readonly<Record<string, string | number>>;
  readonly accepted: boolean;
}

export interface CreateOrderIntent {
  readonly id: string;
  readonly scope: string;
  readonly member: string;
  readonly checkout: string;
  readonly money: Money;
  readonly evidence: unknown;
  readonly address: unknown;
  readonly invoice: unknown;
  readonly delivery: unknown;
  readonly experienceVersion: string | null;
  readonly lines: readonly OrderLineSnapshot[];
}

export interface CheckoutPurchase {
  readonly listing: string;
  readonly dayQuantity: number;
  readonly weekQuantity: number;
  readonly monthQuantity: number;
  readonly lifetimeQuantity: number;
  readonly dayMinor: number;
  readonly weekMinor: number;
  readonly monthMinor: number;
  readonly lifetimeMinor: number;
}

export interface OrderIntentPort {
  purchases(context: ReadTransactionContext, member: string): Promise<readonly CheckoutPurchase[]>;
  create(context: WriteTransactionContext, input: CreateOrderIntent): Promise<Readonly<{ number: string; record: Record<string, unknown> }>>;
  scheduleExpiry(context: WriteTransactionContext, order: string, scope: string): Promise<void>;
}

export const ORDER_INTENT_PORT = publicPort<OrderIntentPort>('order', 'intent');
