import { ORDER_FULFILLMENT_STATES, ORDER_LIFECYCLE_STATES, ORDER_LIST_VIEWS, ORDER_PAYMENT_STATES, ORDER_PLACED_FILTERS } from '@shop/contract/order';
import * as z from 'zod/mini';

export const OrderFilterSchema = z.object({ order: z.string().check(z.trim(), z.maxLength(255)) });
export const OrderListFilterSchema = z.object({
  order: z.string().check(z.trim(), z.maxLength(255)),
  placed: z.enum(['', ...ORDER_PLACED_FILTERS]),
  lifecycle: z.enum(['', ...ORDER_LIFECYCLE_STATES]),
  payment: z.enum(['', ...ORDER_PAYMENT_STATES]),
  fulfillment: z.enum(['', ...ORDER_FULFILLMENT_STATES]),
  mall: z.string().check(z.trim(), z.maxLength(255)),
});
export const OrderViewSchema = z.enum([...ORDER_LIST_VIEWS, 'aftersale']);

export type OrderListFilter = z.infer<typeof OrderListFilterSchema>;
export type OrderView = z.infer<typeof OrderViewSchema>;

export const EMPTY_ORDER_LIST_FILTER: OrderListFilter = Object.freeze({
  order: '',
  placed: '',
  lifecycle: '',
  payment: '',
  fulfillment: '',
  mall: '',
});
