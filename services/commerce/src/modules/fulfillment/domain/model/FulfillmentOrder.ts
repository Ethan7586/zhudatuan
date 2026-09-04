import { FulfillmentState, type FulfillmentStatus } from './FulfillmentState';
import type { FulfillmentKind, FulfillmentRoute } from '../policy/FulfillmentPolicy';

export interface FulfillmentOrderSnapshot {
  readonly id: string;
  readonly order: string;
  readonly route: FulfillmentRoute;
  readonly kind: FulfillmentKind;
  readonly state: FulfillmentStatus;
  readonly lines: readonly Readonly<{ line: string; quantity: number }>[];
  readonly version: number;
}

export class FulfillmentOrder {
  private constructor(readonly value: Readonly<FulfillmentOrderSnapshot>) {}

  static load(value: FulfillmentOrderSnapshot): FulfillmentOrder {
    if (!value.id || !value.order || !Number.isSafeInteger(value.version) || value.version < 0 || value.lines.length === 0) throw new Error('FULFILLMENT_ORDER_INVALID');
    if (new Set(value.lines.map(({ line }) => line)).size !== value.lines.length || value.lines.some(({ line, quantity }) => !line || !Number.isSafeInteger(quantity) || quantity <= 0)) {
      throw new Error('FULFILLMENT_ORDER_LINES_INVALID');
    }
    FulfillmentState.from(value.state);
    return new FulfillmentOrder(Object.freeze({ ...value, lines: Object.freeze(value.lines.map((line) => Object.freeze({ ...line }))) }));
  }

  internalAccepted(): FulfillmentStatus {
    return this.value.route === 'physical' ? 'accepted' : 'completed';
  }

  providerAccepted(providerSucceeded: boolean): FulfillmentStatus {
    return providerSucceeded && (this.value.kind === 'digital' || this.value.kind === 'service') ? 'completed' : 'accepted';
  }

  observed(completed: boolean): FulfillmentStatus {
    return FulfillmentState.from(this.value.state).transition(completed ? 'complete' : 'progress');
  }
}
