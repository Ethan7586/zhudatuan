import { randomUUID } from 'node:crypto';
import type { ContractJsonObject, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, integerField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { RuleRepository } from '../port/RuleRepository';
import { pricingRuleRecordEvent } from '../../domain/event/PricingEvents';
import type { PricingRuleKind } from '../../domain/model/PricingRule';

export class RulesCreateHandler implements OperationHandler<'pricing.rules.create', 'write'> {
  readonly operation = 'pricing.rules.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly rules: RuleRepository) {}

  async execute(input: OperationInputFor<'pricing.rules.create'>, context: WriteHandlerContext<'pricing.rules.create'>): Promise<OperationReply<OperationOutputFor<'pricing.rules.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const rule = await this.rules.create(context.transaction, {
      id: `rule:${randomUUID()}`,
      scope: access.scope.id,
      priority: integerField(body, 'priority'),
      kind: ruleKind(body.kind),
      condition: jsonObject(body.condition),
      effect: jsonObject(body.effect),
      effectiveAt: typeof body.effectiveAt === 'string' ? body.effectiveAt : new Date().toISOString(),
      expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
    });
    return { status: 201, body: rule, events: [pricingRuleRecordEvent('pricing.rule.created', rule, { actor: access.actor.id, trace: context.traceId })] };
  }
}

function jsonObject(value: unknown): ContractJsonObject {
  if (value === undefined) return Object.freeze({});
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRICING_RULE_JSON_INVALID');
  return Object.freeze({ ...(value as ContractJsonObject) });
}
function ruleKind(value: unknown): PricingRuleKind {
  if (value === undefined) return 'markup';
  if (value === 'markup' || value === 'discount' || value === 'tax' || value === 'freight') return value;
  throw new Error('PRICING_RULE_KIND_INVALID');
}
