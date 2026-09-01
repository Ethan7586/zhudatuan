import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { RuleRepository } from '../port/SupportRepositories';

export class RulesManageHandler implements OperationHandler<'support.rules.manage', 'write'> {
  readonly operation = 'support.rules.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly rules: RuleRepository) {}
  execute(input: OperationInputFor<'support.rules.manage'>, context: WriteHandlerContext<'support.rules.manage'>): Promise<OperationReply<OperationOutputFor<'support.rules.manage'>>> {
    const transaction = context.transaction;
    return this.rules.manageRule(transaction, input, context);
  }
}
