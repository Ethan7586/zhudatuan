import { ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '@shop/contract/order';
import * as z from 'zod/mini';

const optionalText = z.string().check(z.trim(), z.maxLength(255));
const optionalAmount = z.string().check(z.trim(), z.regex(/^$|^\d{1,12}$/));
const optionalDate = z.string().check(z.trim(), z.regex(/^$|^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/));

export const OrderReferenceSchema = z.string().check(z.trim(), z.minLength(1), z.maxLength(255));
export const OrderListFilterSchema = z.object({
  search: optionalText,
  placed: z.enum(['', ...ORDER_PLACED_FILTERS]),
  from: optionalDate,
  to: optionalDate,
  lifecycle: z.enum(['', ...ORDER_LIFECYCLE_STATES]),
  payment: z.enum(['', ...ORDER_PAYMENT_STATES]),
  fulfillment: z.enum(['', ...ORDER_FULFILLMENT_STATES]),
  mall: optionalText,
  channel: optionalText,
  product: optionalText,
  member: optionalText,
  minimumMinor: optionalAmount,
  maximumMinor: optionalAmount,
});
export const OrderViewSchema = z.enum([...ORDER_LIST_VIEWS, 'aftersale']);

export type OrderListFilter = z.infer<typeof OrderListFilterSchema>;
export type OrderView = z.infer<typeof OrderViewSchema>;

export const EMPTY_ORDER_LIST_FILTER: OrderListFilter = Object.freeze({
  search: '',
  placed: '',
  from: '',
  to: '',
  lifecycle: '',
  payment: '',
  fulfillment: '',
  mall: '',
  channel: '',
  product: '',
  member: '',
  minimumMinor: '',
  maximumMinor: '',
});
