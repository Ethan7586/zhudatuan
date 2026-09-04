import { OP_PAYMENT_RECOVERIES_RESOLVE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { OrderRecovery, OrderRecoveryAction } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class ResolveRecovery {
  constructor(private readonly port: Pick<OrderPort, 'resolveRecovery'>) {}
  execute(context: ConsoleContext, recovery: OrderRecovery, action: OrderRecoveryAction, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, OP_PAYMENT_RECOVERIES_RESOLVE, identity, proof);
    return this.port.resolveRecovery(context, recovery, action, reason, proof, identity, signal);
  }
}
