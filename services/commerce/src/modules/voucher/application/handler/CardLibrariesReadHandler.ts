import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { CardLibraryRepository } from '../port/CardLibraryRepository';

export class CardLibrariesReadHandler implements OperationHandler<'voucher.cardlibraries.read', 'read'> {
  readonly operation = 'voucher.cardlibraries.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly libraries: CardLibraryRepository) {}
  async execute(input: OperationInputFor<'voucher.cardlibraries.read'>, context: HandlerContext<'voucher.cardlibraries.read'>) {
    const result = await this.libraries.read(context.transaction, input, context);
    return result;
  }
}
