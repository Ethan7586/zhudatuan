import type { FulfillmentProcessEvent } from '../../application/port/FulfillmentEventProcess';

export class ChannelSubscriber {
  receive(eventId: string, scopeId: string, sourceId: string, payload: Readonly<Record<string, unknown>>): FulfillmentProcessEvent {
    const internal = payload.internalReference;
    return Object.freeze({
      eventId: text(eventId, 'FULFILLMENT_EVENT_REQUIRED'),
      eventType: 'channel.webhook.applied' as const,
      scopeId: text(scopeId, 'FULFILLMENT_SCOPE_REQUIRED'),
      sourceId: text(sourceId, 'FULFILLMENT_WEBHOOK_REQUIRED'),
      resourceId: typeof internal === 'string' && internal ? internal : sourceId,
      kind: text(payload.kind, 'FULFILLMENT_CHANNEL_KIND_REQUIRED'),
    });
  }
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}
