import { domainEvent, type DomainEvent } from '@shop/kernel';

export function referralEvent(
  input: Readonly<{
    eventId: string;
    type: string;
    aggregateId: string;
    aggregateVersion: number;
    scopeId: string;
    actorId: string;
    correlationId: string;
    causationId: string;
    occurredAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>
): DomainEvent {
  return domainEvent({
    event: input.eventId,
    type: input.type,
    version: 1,
    aggregate: { type: 'referral', id: input.aggregateId, version: input.aggregateVersion },
    tenant: input.scopeId,
    occurred: input.occurredAt,
    trace: input.correlationId,
    actor: input.actorId,
    correlation: input.correlationId,
    causation: input.causationId,
    payloadVersion: 1,
    payload: input.payload,
  });
}
