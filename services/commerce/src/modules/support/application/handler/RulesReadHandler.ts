import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { RuleRepository } from '../port/SupportRepositories';

export class RulesReadHandler implements OperationHandler<'support.rules.read', 'read'> {
  readonly operation = 'support.rules.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly rules: RuleRepository) {}
  execute(input: OperationInputFor<'support.rules.read'>, context: HandlerContext<'support.rules.read'>): Promise<OperationReply<OperationOutputFor<'support.rules.read'>>> {
    const transaction = context.transaction;
    return this.rules.readRules(transaction, input, context);
  }
}
