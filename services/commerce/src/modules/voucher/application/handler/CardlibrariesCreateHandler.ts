import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { CardLibraryRepository } from '../port/CardLibraryRepository';

export class CardLibrariesCreateHandler implements OperationHandler<'voucher.cardlibraries.create', 'write'> {
  readonly operation = 'voucher.cardlibraries.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly libraries: CardLibraryRepository) {}
  async execute(input: OperationInputFor<'voucher.cardlibraries.create'>, context: WriteHandlerContext<'voucher.cardlibraries.create'>) {
    const result = await this.libraries.create(context.transaction, input, context);
    return result;
  }
}
