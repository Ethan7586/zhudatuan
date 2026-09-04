export type FulfillmentStatus = 'pending' | 'submitted' | 'accepted' | 'processing' | 'ready' | 'completed' | 'cancelled' | 'failed' | 'needsaction';
const transitions = Object.freeze({
  submit: Object.freeze(['pending', 'failed']),
  accept: Object.freeze(['submitted']),
  ship: Object.freeze(['accepted', 'processing', 'ready']),
  progress: Object.freeze(['accepted', 'processing', 'ready']),
  ready: Object.freeze(['accepted', 'processing']),
  complete: Object.freeze(['accepted', 'processing', 'ready']),
  fail: Object.freeze(['submitted', 'accepted', 'processing', 'ready']),
  takeover: Object.freeze(['submitted', 'failed', 'needsaction']),
  retry: Object.freeze(['failed', 'needsaction']),
  cancel: Object.freeze(['pending', 'submitted', 'accepted', 'failed', 'needsaction']),
} as const);

export type FulfillmentAction = keyof typeof transitions;

export class FulfillmentState {
  private constructor(readonly value: FulfillmentStatus) {}

  static from(value: string): FulfillmentState {
    if (!statuses.has(value as FulfillmentStatus)) throw new Error('FULFILLMENT_STATE_REQUIRED');
    return new FulfillmentState(value as FulfillmentStatus);
  }

  transition(action: FulfillmentAction): FulfillmentStatus {
    if (!(transitions[action] as readonly string[]).includes(this.value)) throw new Error('FULFILLMENT_STATE_CONFLICT');
    if (action === 'submit') return 'submitted';
    if (action === 'accept') return 'accepted';
    if (action === 'ship' || action === 'progress') return 'processing';
    if (action === 'ready') return 'ready';
    if (action === 'complete') return 'completed';
    if (action === 'fail') return 'failed';
    if (action === 'takeover') return 'needsaction';
    if (action === 'retry') return 'pending';
    return 'cancelled';
  }
}

const statuses = new Set<FulfillmentStatus>(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed', 'needsaction']);
