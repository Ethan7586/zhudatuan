import { publicPort } from '../../../composition/ModuleRegistry';
export interface ReceiveOrderInput {
  readonly orderId: string;
  readonly scopeId: string;
  readonly scopeIds: readonly string[];
  readonly actorId: string;
  readonly membershipId: string;
  readonly memberId: string | null;
  readonly expectedVersion: number;
  readonly receivedAt: string | null;
  readonly reason: string | null;
  readonly traceId: string;
}
export interface ReceiveOrderOutput {
  readonly orderId: string;
  readonly fulfillmentState: 'received';
  readonly receivedAt: string;
  readonly version: number;
  readonly eventId: string;
  readonly repeated: boolean;
}
export interface OrderReceiptPort {
  receive(input: ReceiveOrderInput): Promise<Readonly<ReceiveOrderOutput>>;
}
export const ORDER_RECEIPT_PORT = publicPort<OrderReceiptPort>('order', 'receipt');
