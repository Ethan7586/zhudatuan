import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';

export function ownershipEvent(
  input: Readonly<{
    type: 'access.owner.transfer.initiated' | 'access.owner.transferred' | 'access.owner.transfer.cancelled' | 'access.owner.transfer.expired';
    transfer: string;
    scope: string;
    actor: string;
    trace: string;
    version: number;
    payload: Readonly<Record<string, unknown>>;
  }>
): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type: input.type,
    version: 1,
    aggregate: { type: 'ownershiptransfer', id: input.transfer, version: input.version },
    tenant: input.scope,
    actor: input.actor,
    occurred: new Date().toISOString(),
    trace: input.trace,
    correlation: input.trace,
    causation: input.trace,
    payloadVersion: 1,
    payload: input.payload,
  });
}
