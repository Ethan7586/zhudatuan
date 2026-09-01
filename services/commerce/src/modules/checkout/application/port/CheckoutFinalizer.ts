import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';

export interface CheckoutFinalizer {
  finalizeRequest(
    input: OperationInputFor<'order.orders.create'>,
    context: FinalizeContext<'order.orders.create'>,
    committed: OperationReply<OperationOutputFor<'order.orders.create'>>
  ): Promise<OperationReply<OperationOutputFor<'order.orders.create'>>>;
}
