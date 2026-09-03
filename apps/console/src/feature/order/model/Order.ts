export type OrderDetailTab = 'overview' | 'products' | 'payment' | 'aftersale' | 'operations';

export interface OrderLine {
  readonly id: string;
  readonly sku: string;
  readonly listing: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly productType: string;
  readonly category: string;
  readonly provider?: string | null;
  readonly partner?: string | null;
}

export interface OrderAddress {
  readonly recipientMasked: string;
  readonly mobileMasked: string;
  readonly addressMasked: string;
  readonly regionCode: string;
}

export interface OrderPaymentTender {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly referenceMasked: string | null;
  readonly amountMinor: number;
  readonly state: 'planned' | 'held' | 'captured' | 'released';
}

export interface OrderPayment {
  readonly paymentId: string | null;
  readonly capturedMinor: number;
  readonly refundedMinor: number;
  readonly refundableMinor: number;
  readonly updatedAt: string | null;
  readonly tenders: readonly OrderPaymentTender[];
}

export interface FulfillmentMilestone {
  readonly id: string;
  readonly kind: string;
  readonly state: string;
  readonly trackingMasked: string | null;
  readonly occurredAt: string;
}

export interface OrderFulfillment {
  readonly id: string;
  readonly provider: string | null;
  readonly partner: string | null;
  readonly kind: 'shipment' | 'delivery' | 'pickup' | 'service' | 'digital';
  readonly state: 'pending' | 'submitted' | 'accepted' | 'processing' | 'ready' | 'completed' | 'cancelled' | 'failed';
  readonly externalReferenceMasked: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly milestones: readonly FulfillmentMilestone[];
}

export interface OrderRefundTender {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly referenceMasked: string | null;
  readonly amountMinor: number;
  readonly state: 'planned' | 'processing' | 'succeeded' | 'failed';
}

export interface OrderRefund {
  readonly id: string;
  readonly aftersaleId: string | null;
  readonly provider: string;
  readonly providerReferenceMasked: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: 'requested' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  readonly reason: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tenders: readonly OrderRefundTender[];
}

export interface OrderAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceMasked: string | null;
  readonly actorMasked: string;
  readonly occurredAt: string;
  readonly traceMasked: string;
}

export interface OrderRecord {
  readonly id: string;
  readonly order_number: string;
  readonly scope_id?: string;
  readonly member_id?: string;
  readonly mall_id?: string;
  readonly total_minor: number;
  readonly currency: string;
  readonly payment_state: 'unpaid' | 'authorizing' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
  readonly fulfillment_state: 'unallocated' | 'allocated' | 'processing' | 'shipped' | 'delivered' | 'received' | 'cancelled' | 'returned';
  readonly aftersale_state: 'none' | 'applied' | 'reviewing' | 'approved' | 'returning' | 'received' | 'refunding' | 'resolved' | 'rejected';
  readonly lifecycle_state: 'created' | 'awaitingpayment' | 'paid' | 'fulfilling' | 'shipped' | 'received' | 'completed' | 'cancelled';
  readonly address: OrderAddress | null;
  readonly payment: OrderPayment;
  readonly fulfillments: readonly OrderFulfillment[];
  readonly refunds: readonly OrderRefund[];
  readonly timeline: readonly OrderAuditEntry[];
  readonly receivedAt: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
  readonly lines: readonly OrderLine[];
}

export interface OrderPage {
  readonly items: readonly OrderRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}
