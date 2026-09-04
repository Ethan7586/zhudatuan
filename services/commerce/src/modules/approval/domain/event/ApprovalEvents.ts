import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '../../../../foundation/domain/DomainEvent';

export function approvalEvent(
  input: Readonly<{
    type: string;
    aggregateType: 'approvaltemplate' | 'approvalinstance' | 'approvaltask';
    aggregateId: string;
    aggregateVersion: number;
    scopeId: string;
    actorId: string;
    traceId: string;
    payload: Readonly<Record<string, unknown>>;
    occurredAt?: string;
  }>
): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type: input.type,
    version: 1,
    aggregate: { type: input.aggregateType, id: input.aggregateId, version: input.aggregateVersion },
    tenant: input.scopeId,
    actor: input.actorId,
    occurred: input.occurredAt ?? new Date().toISOString(),
    trace: input.traceId,
    correlation: input.traceId,
    causation: input.traceId,
    payloadVersion: 1,
    payload: input.payload,
  });
}
