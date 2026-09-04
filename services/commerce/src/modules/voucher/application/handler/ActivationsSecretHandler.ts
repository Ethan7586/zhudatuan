import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { PrepareContext, WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ActivationLookup } from '../port/ActivationRate';
import type { VoucherApplication } from '../service/VoucherApplication';

type Reply = OperationReply<OperationOutputFor<'voucher.activations.secret'>>;
export class ActivationsSecretHandler implements DurableOperationHandler<'voucher.activations.secret', ActivationLookup, Reply, 'write'> {
  readonly operation = 'voucher.activations.secret' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareActivation' | 'activationsSecret'>) {}
  prepare(input: OperationInputFor<'voucher.activations.secret'>, context: PrepareContext<'voucher.activations.secret'>) {
    return this.application.prepareActivation(input, context);
  }
  async commit(input: OperationInputFor<'voucher.activations.secret'>, lookup: ActivationLookup, context: WriteHandlerContext<'voucher.activations.secret'>) {
    const response = await this.application.activationsSecret(input, lookup, context);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'voucher.activations.secret'>, response: Reply): Promise<Reply> {
    return Promise.resolve(response);
  }
}
