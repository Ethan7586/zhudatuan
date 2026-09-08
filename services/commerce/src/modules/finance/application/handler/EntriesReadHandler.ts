import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { JournalReadRepository } from '../port/FinanceReadRepository';

export class EntriesReadHandler implements OperationHandler<'finance.entries.read', 'read'> {
  readonly operation = 'finance.entries.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly journals: JournalReadRepository) {}
  async execute(input: OperationInputFor<'finance.entries.read'>, context: HandlerContext<'finance.entries.read'>) {
    const result = await this.journals.entriesRead(context.transaction, input, context);
    return result;
  }
}
