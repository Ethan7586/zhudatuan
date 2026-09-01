import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ProgramRepository } from '../port/ProgramRepository';

export class ProgramsReadHandler implements OperationHandler<'voucher.programs.read', 'read'> {
  readonly operation = 'voucher.programs.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly programs: ProgramRepository) {}
  async execute(input: OperationInputFor<'voucher.programs.read'>, context: HandlerContext<'voucher.programs.read'>) {
    const result = await this.programs.readPrograms(context.transaction, input, context);
    return result;
  }
}
