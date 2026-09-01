import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ReserveRepository } from '../port/ReserveRepository';

export class ReservesDecideHandler implements OperationHandler<'voucher.reserves.decide', 'write'> {
  readonly operation = 'voucher.reserves.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly reserves: ReserveRepository) {}
  async execute(input: OperationInputFor<'voucher.reserves.decide'>, context: WriteHandlerContext<'voucher.reserves.decide'>) {
    const result = await this.reserves.decideReserve(context.transaction, input, context);
    return result;
  }
}
