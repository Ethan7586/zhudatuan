import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { JournalRepository } from '../port/OperationRepositories';

export class EntriesReadHandler implements OperationHandler<'finance.entries.read', 'read'> {
  readonly operation = 'finance.entries.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly journals: JournalRepository) {}
  async execute(input: OperationInputFor<'finance.entries.read'>, context: HandlerContext<'finance.entries.read'>) {
    const result = await this.journals.entriesRead(context.transaction, input, context);
    return result;
  }
}
