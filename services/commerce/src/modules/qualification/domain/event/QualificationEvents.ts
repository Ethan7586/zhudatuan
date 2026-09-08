import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { QualificationCaseSnapshot, QualificationState } from '../model/QualificationCase';

interface EventContext {
  readonly actor: string;
  readonly trace: string;
}

export function qualificationChangedEvent(value: QualificationCaseSnapshot, context: EventContext): DomainEvent {
  return changed('qualification.changed', value, context);
}

export function qualificationRevokedEvent(value: QualificationCaseSnapshot, context: EventContext): DomainEvent {
  return changed('qualification.revoked', value, context);
}

export function qualificationExpiredEvent(value: QualificationCaseSnapshot, context: EventContext): DomainEvent {
  return changed('qualification.expired', value, context);
}

function changed(type: string, value: QualificationCaseSnapshot, context: EventContext): DomainEvent {
  const byKind = (kind: 'product' | 'category' | 'region') =>
    value.applicability
      .filter((item) => item.kind === kind)
      .map((item) => item.id)
      .concat(value.subject.kind === kind ? [value.subject.id] : []);
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: 'qualificationcase', id: value.id, version: value.version },
    tenant: value.scope,
    actor: context.actor,
    occurred: new Date().toISOString(),
    trace: context.trace,
    correlation: context.trace,
    causation: context.trace,
    payloadVersion: 1,
    payload: {
      qualificationId: value.id,
      subjectKind: value.subject.kind,
      subjectId: value.subject.id,
      productIds: [...new Set(byKind('product'))],
      categoryIds: [...new Set(byKind('category'))],
      regionIds: [...new Set(byKind('region'))],
      state: value.state as QualificationState,
      expiresAt: value.expiresAt,
      version: value.version,
    },
  });
}
