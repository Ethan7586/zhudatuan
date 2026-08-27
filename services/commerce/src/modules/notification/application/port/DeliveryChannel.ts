import type { DeliveryChannelId } from '../../domain/model/Template';

export interface DeliveryRequest {
  readonly recipient: string;
  readonly providerTemplate: string | null;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
  readonly subject: string | null;
  readonly body: string;
  readonly idempotency: string;
}

export interface DeliveryReceipt {
  readonly provider: string;
  readonly externalId: string;
}

export interface DeliveryChannel {
  readonly id: DeliveryChannelId;
  send(request: DeliveryRequest): Promise<DeliveryReceipt>;
}
