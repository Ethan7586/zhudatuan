import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReminderRepository } from '../port/ReminderRepository';

export class RemindersCreateHandler implements OperationHandler<'order.reminders.create', 'write'> {
  readonly operation = 'order.reminders.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly reminders: ReminderRepository) {}
  execute(input: OperationInputFor<'order.reminders.create'>, context: WriteHandlerContext<'order.reminders.create'>): Promise<OperationReply<OperationOutputFor<'order.reminders.create'>>> {
    const transaction = context.transaction;
    return this.reminders.schedule(transaction, input, context);
  }
}
