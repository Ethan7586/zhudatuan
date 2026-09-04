import { DomainError } from '../../../../foundation/domain/DomainError';
import { ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '@shop/contract/order';

export type OrderListView = (typeof ORDER_LIST_VIEWS)[number];
export type OrderPlaced = '' | (typeof ORDER_PLACED_FILTERS)[number];
export type OrderLifecycle = '' | (typeof ORDER_LIFECYCLE_STATES)[number];
export type OrderPayment = '' | (typeof ORDER_PAYMENT_STATES)[number];
export type OrderFulfillment = '' | (typeof ORDER_FULFILLMENT_STATES)[number];

const views = new Set<OrderListView>(ORDER_LIST_VIEWS);
const placedValues = new Set<OrderPlaced>(['', ...ORDER_PLACED_FILTERS]);
const lifecycleValues = new Set<OrderLifecycle>(['', ...ORDER_LIFECYCLE_STATES]);
const paymentValues = new Set<OrderPayment>(['', ...ORDER_PAYMENT_STATES]);
const fulfillmentValues = new Set<OrderFulfillment>(['', ...ORDER_FULFILLMENT_STATES]);

export class OrderReadFilter {
  private constructor(
    readonly search: string,
    readonly order: string,
    readonly view: OrderListView,
    readonly placed: OrderPlaced,
    readonly from: string,
    readonly to: string,
    readonly lifecycle: OrderLifecycle,
    readonly payment: OrderPayment,
    readonly fulfillment: OrderFulfillment,
    readonly mall: string,
    readonly channel: string,
    readonly product: string,
    readonly member: string,
    readonly minimumMinor: number | null,
    readonly maximumMinor: number | null
  ) {}

  static from(input: Readonly<{ query?: Readonly<Record<string, unknown>>; body?: unknown }>): OrderReadFilter {
    const values = input.body && typeof input.body === 'object' && !Array.isArray(input.body)
      ? input.body as Readonly<Record<string, unknown>> : input.query ?? {};
    const search = text(values.search, 128);
    const order = text(values.order, 255);
    const view = choice(values.view, views, 'all');
    const placed = choice(values.placed, placedValues, '');
    const from = timestamp(values.from);
    const to = timestamp(values.to);
    const lifecycle = choice(values.lifecycle, lifecycleValues, '');
    const payment = choice(values.payment, paymentValues, '');
    const fulfillment = choice(values.fulfillment, fulfillmentValues, '');
    const mall = text(values.mall, 255);
    const channel = text(values.channel, 64);
    const product = text(values.product, 128);
    const member = text(values.member, 128);
    const minimumMinor = amount(values.minimumMinor);
    const maximumMinor = amount(values.maximumMinor);
    if (from && to && from >= to) throw new DomainError('VALIDATION_FAILED');
    if (minimumMinor !== null && maximumMinor !== null && minimumMinor > maximumMinor) throw new DomainError('VALIDATION_FAILED');
    return new OrderReadFilter(search, order, view, placed, from, to, lifecycle, payment, fulfillment, mall, channel, product, member, minimumMinor, maximumMinor);
  }

  snapshot(): Readonly<Record<string, string | number>> {
    return Object.freeze(Object.fromEntries(Object.entries({
      search: this.search, view: this.view === 'all' ? '' : this.view, placed: this.placed, from: this.from, to: this.to,
      lifecycle: this.lifecycle, payment: this.payment, fulfillment: this.fulfillment, mall: this.mall, channel: this.channel,
      product: this.product, member: this.member, minimumMinor: this.minimumMinor, maximumMinor: this.maximumMinor,
    }).filter(([, value]) => value !== '' && value !== null)) as Record<string, string | number>);
  }
}

function timestamp(value: unknown): string {
  const selected = text(value, 40);
  if (selected === '') return '';
  const parsed = new Date(selected);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== selected) throw new DomainError('VALIDATION_FAILED');
  return selected;
}

function amount(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const selected = Array.isArray(value) ? value[0] : value;
  const parsed = typeof selected === 'number' ? selected : typeof selected === 'string' && /^\d+$/.test(selected) ? Number(selected) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new DomainError('VALIDATION_FAILED');
  return parsed;
}

function text(value: unknown, maximum: number): string {
  const selected = Array.isArray(value) ? value[0] : value;
  if (selected === undefined || selected === null) return '';
  if (typeof selected !== 'string' || selected.trim().length > maximum) throw new DomainError('VALIDATION_FAILED');
  return selected.trim();
}

function choice<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  const selected = text(value, 32);
  if (selected === '') return fallback;
  if (!allowed.has(selected as T)) throw new DomainError('VALIDATION_FAILED');
  return selected as T;
}
