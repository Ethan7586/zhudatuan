import type { DeliveryChannel, DeliveryRequest } from '@shop/contract';

export class InappClient implements DeliveryChannel {
  readonly id = 'inapp' as const;

  send(request: DeliveryRequest) {
    if (!request.idempotency.trim() || !request.recipient.trim()) throw new Error('INAPP_DELIVERY_REQUEST_INVALID');
    return Promise.resolve(Object.freeze({ provider: 'inapp', externalId: request.idempotency }));
  }
}
