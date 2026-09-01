import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { ProgramRepository } from '../port/ProgramRepository';

export class ProgramsManageHandler implements OperationHandler<'voucher.programs.manage', 'write'> {
  readonly operation = 'voucher.programs.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly programs: ProgramRepository) {}
  async execute(input: OperationInputFor<'voucher.programs.manage'>, context: WriteHandlerContext<'voucher.programs.manage'>) {
    const result = await this.programs.manageProgram(context.transaction, input, context);
    return result;
  }
}
