import type { DeliveryChannel } from '../../01_public_gongkai/DeliveryChannel';

export class InappChannel implements DeliveryChannel {
  readonly id = 'inapp' as const;
  send(request: Parameters<DeliveryChannel['send']>[0]) {
    return Promise.resolve({ provider: 'inapp', externalId: request.idempotency });
  }
}
