import { OP_PAYMENT_REFUNDS_REQUEST } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderDetail } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class RefundOrder {
  constructor(private readonly port: Pick<OrderPort, 'refund'>) {}
  execute(context: ConsoleContext, order: OrderDetail, amountMinor: number, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_PAYMENT_REFUNDS_REQUEST, identity, proof);
    return this.port.refund(context, order, amountMinor, reason, proof, identity, signal);
  }
}
