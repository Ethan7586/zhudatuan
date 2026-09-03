import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OrderRepository } from '../port/OrderRepository';
import type { OrderAuditReadPort } from '../../../audit/public';

export class OrdersReadHandler implements OperationHandler<'order.orders.read', 'read'> {
  readonly operation = 'order.orders.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly orders: OrderRepository,
    private readonly audit: OrderAuditReadPort
  ) {}
  async execute(input: OperationInputFor<'order.orders.read'>, context: HandlerContext<'order.orders.read'>): Promise<OperationReply<OperationOutputFor<'order.orders.read'>>> {
    const transaction = context.transaction;
    const reply = await this.orders.read(transaction, input, context);
    if (!input.query?.order || reply.body.items.length !== 1) return reply;
    const order = reply.body.items[0]!;
    const resources = new Set<string>([order.id]);
    if (order.payment.paymentId) resources.add(order.payment.paymentId);
    for (const fulfillment of order.fulfillments) resources.add(fulfillment.id);
    for (const refund of order.refunds) {
      resources.add(refund.id);
      if (refund.aftersaleId) resources.add(refund.aftersaleId);
    }
    const timeline = await this.audit.timeline(transaction, order.scope_id, [...resources]);
    return {
      ...reply,
      body: Object.freeze({ ...reply.body, items: Object.freeze([Object.freeze({ ...order, timeline })]) }),
    } as OperationReply<OperationOutputFor<'order.orders.read'>>;
  }
}
