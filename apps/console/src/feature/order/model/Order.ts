import type { OperationBodyFor, OperationOutputFor, OrderAfterSaleDecision } from '@shop/contract';
import type { DeepReadonly } from '../../../shared/model/Immutable';

type OrderPageOutput = DeepReadonly<OperationOutputFor<'order.orders.read'>>;
type OrderDetailOutput = DeepReadonly<OperationOutputFor<'order.detail.read'>>;
type SupportCaseOutput = DeepReadonly<OperationOutputFor<'support.cases.read'>['items'][number]>;
type RecoveryOutput = DeepReadonly<OperationOutputFor<'payment.recoveries.read'>['items'][number]>;
type ReturnOutput = DeepReadonly<OperationOutputFor<'fulfillment.returns.receive'>>;

export type OrderDetailTab = 'overview' | 'products' | 'payment' | 'aftersale' | 'finance' | 'support' | 'operations';
export type OrderPageTab = 'overview' | 'products' | 'payment' | 'fulfillment' | 'aftersale' | 'finance' | 'support' | 'audit';

export type OrderRecord = OrderPageOutput['items'][number];
export type OrderLine = OrderRecord['lines'][number];
export type OrderAddress = NonNullable<OrderRecord['address']>;
export type OrderPayment = OrderRecord['payment'];
export type OrderPaymentTender = OrderPayment['tenders'][number];
export type OrderFulfillment = OrderRecord['fulfillments'][number];
export type FulfillmentMilestone = OrderFulfillment['milestones'][number];
export type OrderRefund = OrderRecord['refunds'][number];
export type OrderRefundTender = OrderRefund['tenders'][number];
export type OrderAuditEntry = OrderRecord['timeline'][number];

export type OrderDetailSectionState<T> =
  | Readonly<{ state: 'ready'; data: T }>
  | Readonly<{ state: 'hidden' }>
  | Readonly<{ state: 'unavailable'; error: Readonly<{ code: string; message: string; retryable: boolean; traceId?: string }> }>;

export type OrderFinance = Extract<OrderDetailOutput['finance'], { state: 'ready' }>['data'];

export interface OrderSupportCase {
  readonly id: string;
  readonly subject: string;
  readonly state: SupportCaseOutput['state'];
  readonly priority: SupportCaseOutput['priority'];
  readonly assignedAgentId: string | null;
  readonly unreadCount: number;
  readonly slaRisk: SupportCaseOutput['sla_risk'];
  readonly updatedAt: string;
}

export interface OrderRecovery {
  readonly id: string;
  readonly orderId: string | null;
  readonly orderNumber: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly severity: RecoveryOutput['severity'];
  readonly state: RecoveryOutput['state'];
  readonly errorCode: string;
  readonly occurrenceCount: number;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly resolutionRequestId: string | null;
  readonly version: number;
}

export interface OrderRecoveryPage {
  readonly items: readonly OrderRecovery[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type OrderRecoveryState =
  | Readonly<{ state: 'loading' }>
  | Readonly<{ state: 'ready'; data: OrderRecoveryPage }>
  | Readonly<{ state: 'hidden' }>
  | Readonly<{ state: 'unavailable'; error: Readonly<{ message: string; retryable: boolean; traceId?: string }> }>;

export interface OrderReturn {
  readonly id: string;
  readonly state: ReturnOutput['state'];
  readonly provider: string | null;
  readonly providerReferenceMasked: string | null;
  readonly trackingMasked: string | null;
  readonly version: number;
}

export interface OrderOperationReceipt {
  readonly id: string;
  readonly state: string;
  readonly version?: number;
  readonly requestId?: string;
}

export type OrderSupportState =
  | Readonly<{ state: 'loading' }>
  | Readonly<{ state: 'ready'; data: readonly OrderSupportCase[] }>
  | Readonly<{ state: 'hidden' }>
  | Readonly<{ state: 'unavailable'; error: Readonly<{ message: string; retryable: boolean; traceId?: string }> }>;

export interface OrderDetail {
  readonly id: OrderDetailOutput['summary']['id'];
  readonly order_number: OrderDetailOutput['summary']['orderNumber'];
  readonly scope_id: OrderDetailOutput['summary']['scopeId'];
  readonly mall_id: OrderDetailOutput['summary']['mallId'];
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
export type { OrderAfterSaleDecision };
