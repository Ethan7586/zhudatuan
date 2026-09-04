import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { PrepareContext, WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ActivationLookup } from '../port/ActivationRate';
import type { VoucherApplication } from '../service/VoucherApplication';

type Reply = OperationReply<OperationOutputFor<'voucher.activations.numbersecret'>>;
export class ActivationsNumberSecretHandler implements DurableOperationHandler<'voucher.activations.numbersecret', ActivationLookup, Reply, 'write'> {
  readonly operation = 'voucher.activations.numbersecret' as const;
  readonly mode = 'write' as const;
  constructor(private readonly application: Pick<VoucherApplication, 'prepareActivation' | 'activationsNumbersecret'>) {}
  prepare(input: OperationInputFor<'voucher.activations.numbersecret'>, context: PrepareContext<'voucher.activations.numbersecret'>) {
    return this.application.prepareActivation(input, context);
  }
  async commit(input: OperationInputFor<'voucher.activations.numbersecret'>, lookup: ActivationLookup, context: WriteHandlerContext<'voucher.activations.numbersecret'>) {
    const response = await this.application.activationsNumbersecret(input, lookup, context);
    return { checkpoint: response, response };
  }
  finalize(_input: OperationInputFor<'voucher.activations.numbersecret'>, response: Reply): Promise<Reply> {
    return Promise.resolve(response);
  }
}
