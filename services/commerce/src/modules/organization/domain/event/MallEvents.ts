import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { Mall } from '../model/Mall';

export function mallCreatedEvent(mall: Mall, actor: string, trace: string): DomainEvent {
  return mallEvent('created', mall, actor, trace, mall.createdat);
}

export function mallUpdatedEvent(mall: Mall, actor: string, trace: string): DomainEvent {
  return mallEvent('updated', mall, actor, trace, mall.updatedat);
}

function mallEvent(action: 'created' | 'updated', mall: Mall, actor: string, trace: string, occurred: string): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type: `organization.mall.${action}`,
    version: 1,
    aggregate: { type: 'mall', id: mall.organization.id, version: mall.version },
    tenant: mall.organization.id,
    actor,
    occurred,
    trace,
    correlation: trace,
    causation: trace,
    payloadVersion: 1,
    payload: {
      mallId: mall.organization.id,
      parentId: mall.organization.parentid!,
      ownerMembershipId: mall.ownerMembershipId,
      code: mall.code,
      publicSlug: mall.publicSlug,
      version: mall.version,
    },
  });
}
