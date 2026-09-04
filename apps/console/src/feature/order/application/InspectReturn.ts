import { OP_FULFILLMENT_RETURNS_INSPECT } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderReturn } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class InspectReturn {
  constructor(private readonly port: Pick<OrderPort, 'inspectReturn'>) {}
  execute(context: ConsoleContext, target: OrderReturn, accepted: boolean, note: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_FULFILLMENT_RETURNS_INSPECT, identity);
    return this.port.inspectReturn(context, target, accepted, note, identity, signal);
  }
}
