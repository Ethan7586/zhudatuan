const transitions = Object.freeze({
  submit: Object.freeze(['pending', 'failed']),
  ship: Object.freeze(['accepted', 'processing', 'ready']),
  progress: Object.freeze(['accepted', 'processing', 'ready']),
  complete: Object.freeze(['accepted', 'processing', 'ready']),
  cancel: Object.freeze(['pending', 'submitted', 'accepted', 'failed']),
} as const);

export type FulfillmentAction = keyof typeof transitions;

export class FulfillmentState {
  private constructor(readonly value: string) {}

  static from(value: string): FulfillmentState {
    if (!value) throw new Error('FULFILLMENT_STATE_REQUIRED');
    return new FulfillmentState(value);
  }

  transition(action: FulfillmentAction): string {
    if (!(transitions[action] as readonly string[]).includes(this.value)) throw new Error('FULFILLMENT_STATE_CONFLICT');
    if (action === 'submit') return 'accepted';
    if (action === 'ship' || action === 'progress') return 'processing';
    if (action === 'complete') return 'completed';
    return 'cancelled';
  }
}
