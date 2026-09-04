import { DomainError } from '../../../../foundation/domain/DomainError';
import type { FulfillmentState } from './Order';

export interface OrderFulfillmentSnapshot {
  readonly state: FulfillmentState;
  readonly route: readonly Readonly<{ line: string; quantity: number; kind: string; provider: string | null; partner: string | null }>[];
  readonly addressHash: string | null;
}

export class OrderFulfillment {
  private constructor(readonly value: OrderFulfillmentSnapshot) {}

  static freeze(value: OrderFulfillmentSnapshot): OrderFulfillment {
    if (value.addressHash !== null && !/^[a-f0-9]{64}$/.test(value.addressHash)) invalid();
    if (value.route.some((line) => !line.line || !line.kind || !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) invalid();
    if (new Set(value.route.map(({ line }) => line)).size !== value.route.length) invalid();
    return new OrderFulfillment(Object.freeze({ ...value, route: Object.freeze(value.route.map((line) => Object.freeze({ ...line }))) }));
  }
}

function invalid(): never {
  throw new DomainError('ORDER_SNAPSHOT_INVALID');
}
