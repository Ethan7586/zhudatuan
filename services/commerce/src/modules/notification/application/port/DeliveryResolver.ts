import type { DeliveryChannel } from './DeliveryChannel';

export interface DeliveryStrategy {
  readonly channel: string;
  readonly provider: string;
  readonly priority: number;
  send(request: Parameters<DeliveryChannel['send']>[0]): ReturnType<DeliveryChannel['send']>;
}

export interface DeliveryResolver {
  resolve(id: string): readonly DeliveryStrategy[];
}
