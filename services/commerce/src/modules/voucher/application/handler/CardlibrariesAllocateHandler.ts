import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { CardLibraryRepository } from '../port/CardLibraryRepository';

export class CardLibrariesAllocateHandler implements OperationHandler<'voucher.cardlibraries.allocate', 'write'> {
  readonly operation = 'voucher.cardlibraries.allocate' as const;
  readonly mode = 'write' as const;
  constructor(private readonly libraries: CardLibraryRepository) {}
  async execute(input: OperationInputFor<'voucher.cardlibraries.allocate'>, context: WriteHandlerContext<'voucher.cardlibraries.allocate'>) {
    const result = await this.libraries.allocate(context.transaction, input, context);
    return result;
  }
}
