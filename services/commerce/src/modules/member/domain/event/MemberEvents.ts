import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '../../../../foundation/domain/DomainEvent';

interface EventContext {
  readonly member: string;
  readonly scope: string;
  readonly actor: string;
  readonly trace: string;
}

export function addressChangedEvent(context: EventContext, input: Readonly<{ address: string; state: 'active' | 'deleted'; isDefault: boolean; version: number }>): DomainEvent {
  return changedEvent('member.address.changed', 'address', input.address, input.version, context, {
    memberId: context.member,
    addressId: input.address,
    state: input.state,
    isDefault: input.isDefault,
    version: input.version,
  });
}

export function favoriteChangedEvent(context: EventContext, input: Readonly<{ listing: string; state: 'active' | 'removed'; version: number }>): DomainEvent {
  return changedEvent('member.favorite.changed', 'favoritelist', context.member, input.version, context, {
    memberId: context.member,
    listingId: input.listing,
    state: input.state,
    version: input.version,
  });
}

function changedEvent(type: string, aggregateType: string, aggregateId: string, version: number, context: EventContext, payload: Readonly<Record<string, unknown>>): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: aggregateType, id: aggregateId, version },
    tenant: context.scope,
    actor: context.actor,
    occurred: new Date().toISOString(),
    trace: context.trace,
    correlation: context.trace,
    causation: context.trace,
    payloadVersion: 1,
    payload,
  });
}
