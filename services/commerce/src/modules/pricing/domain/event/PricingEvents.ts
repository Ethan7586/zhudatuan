import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { PricingRuleSnapshot } from '../model/PricingRule';

interface EventContext {
  readonly actor: string;
  readonly trace: string;
}

export function pricingRuleEvent(type: 'pricing.rule.created' | 'pricing.rule.published', rule: PricingRuleSnapshot, context: EventContext): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: 'pricingrule', id: rule.id, version: rule.version },
    tenant: rule.scope,
    actor: context.actor,
    trace: context.trace,
    occurred: new Date().toISOString(),
    payload: { rule: rule.id, scope: rule.scope, status: rule.state, version: rule.version },
  });
}

export function pricingRuleRecordEvent(type: 'pricing.rule.created' | 'pricing.rule.published', record: Readonly<Record<string, unknown>>, context: EventContext): DomainEvent {
  return pricingRuleEvent(
    type,
    {
      id: String(record.id),
      scope: String(record.scope_id),
      priority: Number(record.priority),
      kind: record.kind as PricingRuleSnapshot['kind'],
      condition: record.condition as Readonly<Record<string, unknown>>,
      effect: record.effect as Readonly<Record<string, unknown>>,
      version: Number(record.version),
      state: record.status as PricingRuleSnapshot['state'],
      effectiveAt: String(record.effective_at),
      expiresAt: typeof record.expires_at === 'string' ? record.expires_at : null,
      approvedBy: typeof record.approved_by === 'string' ? record.approved_by : null,
    },
    context
  );
}
