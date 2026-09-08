import type { OperationBodyFor, OperationOutputFor, OrderAfterSaleDecision } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

type OrderPageOutput = DeepReadonly<OperationOutputFor<'order.orders.read'>>;
type OrderDetailOutput = DeepReadonly<OperationOutputFor<'order.detail.read'>>;
import type { OrderAuditEntry, OrderFulfillment, OrderLine, OrderPayment, OrderRefund } from './OrderState';
export * from './OrderState';
export type { OrderAfterSaleDecision };

export interface OrderDetail {
  readonly id: OrderDetailOutput['summary']['id'];
  readonly order_number: OrderDetailOutput['summary']['orderNumber'];
  readonly member_id: OrderDetailOutput['summary']['memberId'];
  readonly member_name: OrderDetailOutput['summary']['memberName'];
  readonly scope_id: OrderDetailOutput['summary']['scopeId'];
  readonly scope_name: OrderDetailOutput['summary']['scopeName'];
  readonly mall_id: OrderDetailOutput['summary']['mallId'];
  readonly mall_name: OrderDetailOutput['summary']['mallName'];
  readonly total_minor: OrderDetailOutput['summary']['totalMinor'];
  readonly currency: OrderDetailOutput['summary']['currency'];
  readonly payment_state: OrderDetailOutput['summary']['paymentState'];
  readonly fulfillment_state: OrderDetailOutput['summary']['fulfillmentState'];
  readonly aftersale_state: OrderDetailOutput['summary']['aftersaleState'];
  readonly lifecycle_state: OrderDetailOutput['summary']['lifecycleState'];
  readonly address: OrderDetailOutput['summary']['address'];
  readonly payment: OrderPayment;
  readonly fulfillments: readonly OrderFulfillment[];
  readonly refunds: readonly OrderRefund[];
  readonly timeline: readonly OrderAuditEntry[];
  readonly receivedAt: OrderDetailOutput['summary']['receivedAt'];
  readonly created_at: OrderDetailOutput['summary']['createdAt'];
  readonly updated_at: OrderDetailOutput['summary']['updatedAt'];
  readonly version: OrderDetailOutput['summary']['version'];
  readonly lines: readonly OrderLine[];
  readonly sourceChannel: OrderDetailOutput['summary']['sourceChannel'];
  readonly externalOrderNo: OrderDetailOutput['summary']['externalOrderNo'];
  readonly sourceState: OrderDetailOutput['summary']['sourceState'];
  readonly verificationState: OrderDetailOutput['summary']['verificationState'];
  readonly orderedAt: OrderDetailOutput['summary']['orderedAt'];
  readonly sections: Readonly<{
    products: OrderDetailOutput['products'];
    payment: OrderDetailOutput['payment'];
    fulfillment: OrderDetailOutput['fulfillment'];
    aftersale: OrderDetailOutput['aftersale'];
    finance: OrderDetailOutput['finance'];
    audit: OrderDetailOutput['audit'];
  }>;
}

export interface OrderImportSource {
  readonly file: File;
}

type ImportOutput = OperationOutputFor<'order.imports.read'>;
export interface OrderImportTask {
  readonly id: string;
  readonly state: ImportOutput['state'];
  readonly totalCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type ExportOutput = OperationOutputFor<'order.orders.export'>;
export interface OrderExportTask {
  readonly id: string;
  readonly state: ExportOutput['state'];
  readonly watermark: string;
  readonly createdAt: string;
}

export interface OrderCommandReceipt {
  readonly id: string;
  readonly orderId: string;
  readonly state: string;
  readonly version?: number;
  readonly occurredAt: string;
}

export type OrderFacetData = Extract<OrderPageOutput['facets'], { state: 'ready' }>['data'];
export type OrderPage = OrderPageOutput;
export type OrderRecoveryAction = OperationBodyFor<'PaymentRecoveriesResolveInput'>['action'];
