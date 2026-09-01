import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ReserveRepository } from '../port/ReserveRepository';

export class ReservesRequestHandler implements OperationHandler<'voucher.reserves.request', 'write'> {
  readonly operation = 'voucher.reserves.request' as const;
  readonly mode = 'write' as const;
  constructor(private readonly reserves: ReserveRepository) {}
  async execute(input: OperationInputFor<'voucher.reserves.request'>, context: WriteHandlerContext<'voucher.reserves.request'>) {
    const result = await this.reserves.requestReserve(context.transaction, input, context);
    return result;
  }
}
