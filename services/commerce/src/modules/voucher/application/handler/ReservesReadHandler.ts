import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ReserveRepository } from '../port/ReserveRepository';

export class ReservesReadHandler implements OperationHandler<'voucher.reserves.read', 'read'> {
  readonly operation = 'voucher.reserves.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly reserves: ReserveRepository) {}
  async execute(input: OperationInputFor<'voucher.reserves.read'>, context: HandlerContext<'voucher.reserves.read'>) {
    const result = await this.reserves.readReserves(context.transaction, input, context);
    return result;
  }
}
