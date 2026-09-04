import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface OrderDetailSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly scopeId: string;
  readonly mallId: string;
  readonly currency: string;
  readonly totalMinor: number;
  readonly paymentState: string;
  readonly fulfillmentState: string;
  readonly aftersaleState: string;
  readonly lifecycleState: string;
  readonly sourceChannel: string | null;
  readonly externalOrderNo: string | null;
  readonly sourceState: string | null;
  readonly verificationState: 'verified' | 'pending' | 'rejected';
  readonly orderedAt: Date;
  readonly address: unknown | null;
  readonly receivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface OrderFinanceSummary {
  readonly grossMinor: number;
  readonly capturedMinor: number;
  readonly refundedMinor: number;
  readonly netMinor: number;
  readonly outstandingMinor: number;
  readonly currency: string;
  readonly state: 'pending' | 'balanced' | 'partialrefund' | 'refunded' | 'attention';
  readonly verificationState: 'verified' | 'pending' | 'rejected';
  readonly watermark: Date;
}

export interface OrderDetailRepository {
  summary(context: ReadTransactionContext, order: string, execution: ExecutionContext<'order.detail.read'>): Promise<OrderDetailSummary | null>;
  products(context: ReadTransactionContext, order: string, partner: string | null): Promise<readonly Readonly<Record<string, unknown>>[]>;
  payment(context: ReadTransactionContext, order: string): Promise<Readonly<Record<string, unknown>>>;
  fulfillment(context: ReadTransactionContext, order: string, partner: string | null): Promise<readonly Readonly<Record<string, unknown>>[]>;
  aftersale(context: ReadTransactionContext, order: string): Promise<Readonly<Record<string, unknown>>>;
  finance(context: ReadTransactionContext, order: string): Promise<OrderFinanceSummary>;
}
