import type { DeliveryChannel } from '../../application/port/DeliveryChannel';

export class InappChannel implements DeliveryChannel {
  readonly id = 'inapp' as const;
  send(request: Parameters<DeliveryChannel['send']>[0]) {
    return Promise.resolve({ provider: 'inapp', externalId: request.idempotency });
  }
}
