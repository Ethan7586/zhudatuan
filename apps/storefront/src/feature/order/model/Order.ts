import type { Address } from '../../account/model/Address';
import type { OrderLine } from './OrderLine';
import type { Timeline } from './Timeline';

export type OrderStatus = 'pending_payment' | 'pending_shipment' | 'pending_receipt' | 'completed' | 'after_sale';

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
  readonly address?: Address;
  readonly version: number;
}
