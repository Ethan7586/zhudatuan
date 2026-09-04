import { OP_ORDER_AFTERSALES_APPROVE, OP_ORDER_AFTERSALES_REJECT } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleRecord } from '../model/AfterSale';
import type { OrderAfterSaleDecision } from '../model/Order';
import type { OrderPort } from '../public';
import { assertCommandAccess } from './CommandAccess';

export class ApplyAfterSaleDecision {
  constructor(private readonly port: Pick<OrderPort, 'decideAftersale'>) {}
  execute(context: ConsoleContext, sale: AfterSaleRecord, decision: OrderAfterSaleDecision, reason: string, identity: string, signal?: AbortSignal) {
    assertCommandAccess(context, decision === 'approve' ? OP_ORDER_AFTERSALES_APPROVE : OP_ORDER_AFTERSALES_REJECT, identity);
    if (sale.state !== 'reviewing' || reason.trim().length < 2) throw new Error('ORDER_AFTERSALE_NOT_ALLOWED');
    return this.port.decideAftersale(context, sale, decision, reason, identity, signal);
  }
}
