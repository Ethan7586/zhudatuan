import type { BatchDeliveryChannel, DeliveryReceipt, DeliveryRequest } from '@shop/contract';
import type { InappConfiguration } from './Config';

export class InappClient implements BatchDeliveryChannel {
  readonly id = 'inapp' as const;
  readonly provider = 'inapp';
  readonly priority = 0;

  constructor(private readonly configuration: InappConfiguration) {}

  send(request: DeliveryRequest): Promise<DeliveryReceipt> {
    validate(request);
    return Promise.resolve(Object.freeze({ provider: 'inapp', externalId: request.idempotency }));
  }

  async sendBatch(requests: readonly DeliveryRequest[]): Promise<readonly DeliveryReceipt[]> {
    if (requests.length < 1 || requests.length > this.configuration.maxBatchSize) throw new Error('INAPP_BATCH_SIZE_INVALID');
    requests.forEach(validate);
    if (new Set(requests.map(({ idempotency }) => idempotency)).size !== requests.length) throw new Error('INAPP_BATCH_IDEMPOTENCY_DUPLICATE');
    return Object.freeze(requests.map(({ idempotency }) => Object.freeze({ provider: 'inapp', externalId: idempotency })));
  }
}

function validate(request: DeliveryRequest): void {
  if (request.signal?.aborted) throw request.signal.reason ?? new Error('INAPP_DELIVERY_CANCELLED');
  if (request.deadline !== undefined && Date.now() >= request.deadline) throw new Error('INAPP_DELIVERY_DEADLINE_EXCEEDED');
  if (!request.idempotency.trim() || !/^(?:member|scope):[A-Za-z0-9:._-]{1,240}$/.test(request.recipient)) throw new Error('INAPP_DELIVERY_REQUEST_INVALID');
}
