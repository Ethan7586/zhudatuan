import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RuleRepository } from '../port/RuleRepository';
import { pricingRuleRecordEvent } from '../../domain/event/PricingEvents';

export class RulesPublishHandler implements OperationHandler<'pricing.rules.publish', 'write'> {
  readonly operation = 'pricing.rules.publish' as const;
  readonly mode = 'write' as const;

  constructor(private readonly rules: RuleRepository) {}

  async execute(input: OperationInputFor<'pricing.rules.publish'>, context: WriteHandlerContext<'pricing.rules.publish'>): Promise<OperationReply<OperationOutputFor<'pricing.rules.publish'>>> {
    const access = requireSession(context.security);
    const rule = await this.rules.publish(context.transaction, input.path.ruleid, context.expectedVersion!, access.actor.id);
    if (!rule) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: rule, events: [pricingRuleRecordEvent('pricing.rule.published', rule, { actor: access.actor.id, trace: context.traceId })] };
  }
}
