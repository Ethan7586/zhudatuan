import { OP_FULFILLMENT_RETURNS_RECEIVE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderReturn } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class ReceiveReturn {
  constructor(private readonly port: Pick<OrderPort, 'receiveReturn'>) {}
  execute(context: ConsoleContext, target: OrderReturn, tracking: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_FULFILLMENT_RETURNS_RECEIVE, identity);
    return this.port.receiveReturn(context, target, tracking, identity, signal);
  }
}
