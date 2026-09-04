import type { FulfillmentProcessEvent } from '../../application/port/FulfillmentEventProcess';

export class VerificationSubscriber {
  receive(eventId: string, scopeId: string, sourceId: string, payload: Readonly<Record<string, unknown>>): FulfillmentProcessEvent {
    return Object.freeze({
      eventId: text(eventId, 'FULFILLMENT_EVENT_REQUIRED'),
      eventType: 'verification.completed' as const,
      scopeId: text(scopeId, 'FULFILLMENT_SCOPE_REQUIRED'),
      sourceId: text(sourceId, 'FULFILLMENT_VERIFICATION_REQUIRED'),
      resourceId: text(payload.subject, 'FULFILLMENT_VERIFICATION_SUBJECT_REQUIRED'),
      subjectType: text(payload.subjectType, 'FULFILLMENT_VERIFICATION_SUBJECT_TYPE_REQUIRED'),
    });
  }
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
