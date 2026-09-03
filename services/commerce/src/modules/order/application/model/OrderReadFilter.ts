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
    readonly order: string,
    readonly view: OrderListView,
    readonly placed: OrderPlaced,
    readonly lifecycle: OrderLifecycle,
    readonly payment: OrderPayment,
    readonly fulfillment: OrderFulfillment,
    readonly mall: string
  ) {}

  static from(input: Readonly<{ query?: Readonly<Record<string, unknown>> }>): OrderReadFilter {
    const order = text(input.query?.order, 255);
    const view = choice(input.query?.view, views, 'all');
    const placed = choice(input.query?.placed, placedValues, '');
    const lifecycle = choice(input.query?.lifecycle, lifecycleValues, '');
    const payment = choice(input.query?.payment, paymentValues, '');
    const fulfillment = choice(input.query?.fulfillment, fulfillmentValues, '');
    const mall = text(input.query?.mall, 255);
    return new OrderReadFilter(order, view, placed, lifecycle, payment, fulfillment, mall);
  }
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
