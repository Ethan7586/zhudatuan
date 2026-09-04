import type { OrderListFilter } from './OrderFilter';
import type { OrderReturn } from './Order';
import type { OperationOutputFor } from '@shop/contract';

export interface AfterSaleQuery extends OrderListFilter {
  readonly cursor?: string;
}

export type AfterSaleState = OperationOutputFor<'order.aftersales.read'>['items'][number]['state'];

export interface AfterSaleLine {
  readonly lineId: string;
  readonly skuId: string;
  readonly listingId: string;
  readonly title: string;
  readonly productType: string;
  readonly provider: string | null;
  readonly purchasedQuantity: number;
  readonly fulfilledQuantity: number;
  readonly claimedQuantity: number;
  readonly requestedQuantity: number;
  readonly maximumQuantity: number;
  readonly unitMinor: number;
  readonly refundMinor: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

export interface AfterSaleTender {
  readonly kind: string;
  readonly reference: string | null;
  readonly amountMinor: number;
}

export interface AfterSaleAttachment {
  readonly objectId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

export interface AfterSaleTimelineEntry {
  readonly sequence: number;
  readonly kind: string;
  readonly previousState: AfterSaleState | null;
  readonly state: AfterSaleState;
  readonly evidence: unknown;
  readonly occurredAt: string;
}

export interface AfterSaleRecord {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly state: AfterSaleState;
  readonly reasonCode: string;
  readonly description: string;
  readonly currency: string;
  readonly expectedRefundMinor: number;
  readonly expectedRefund: Readonly<{ totalMinor: number; currency: string; tenders: readonly AfterSaleTender[] }>;
  readonly requiresReturn: boolean;
  readonly unavailableReason: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly lines: readonly AfterSaleLine[];
  readonly attachments: readonly AfterSaleAttachment[];
  readonly timeline: readonly AfterSaleTimelineEntry[];
  readonly returns: readonly OrderReturn[];
}

export interface AfterSalePage {
  readonly items: readonly AfterSaleRecord[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly availableLines: readonly unknown[];
}
