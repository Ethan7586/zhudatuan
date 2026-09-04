import type { OrderLine } from './OrderLine';
import type { Timeline } from './Timeline';

export type OrderStatus = 'pending_payment' | 'pending_shipment' | 'pending_receipt' | 'completed' | 'after_sale';

export type OrderSectionState = 'ready' | 'hidden' | 'unavailable';

export interface OrderAddress {
  readonly recipient: string;
  readonly mobile: string;
  readonly detail: string;
  readonly regionCode: string;
}

export interface Order {
  readonly id: string;
  readonly orderNo: string;
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly mallId: string;
  readonly mallName: string;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly paymentState: string;
  readonly fulfillmentState: string;
  readonly aftersaleState: string;
  readonly lifecycleState: string;
  readonly lines: readonly OrderLine[];
  readonly timeline: readonly Timeline[];
  readonly address?: OrderAddress;
  readonly receivedAt: string | null;
  readonly sourceChannel: string | null;
  readonly externalOrderNo: string | null;
  readonly payment: Readonly<{ capturedMinor: number; refundedMinor: number; refundableMinor: number }>;
  readonly sections: Readonly<Record<'products' | 'payment' | 'fulfillment' | 'aftersale' | 'audit', Readonly<{ state: OrderSectionState; message?: string; retryable?: boolean }>>>;
  readonly version: number;
}
