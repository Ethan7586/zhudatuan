import { describe, expect, it } from 'vitest';
import { FulfillmentState } from './FulfillmentState';
import { ReturnState } from './ReturnState';

describe('fulfillment state machines', () => {
  it('accepts only explicit fulfillment transitions', () => {
    expect(FulfillmentState.from('pending').transition('submit')).toBe('accepted');
    expect(FulfillmentState.from('accepted').transition('ship')).toBe('processing');
    expect(FulfillmentState.from('processing').transition('complete')).toBe('completed');
    expect(() => FulfillmentState.from('completed').transition('progress')).toThrow('FULFILLMENT_STATE_CONFLICT');
  });

  it('requires return receipt before inspection', () => {
    expect(ReturnState.from('authorized').receive()).toBe('received');
    expect(ReturnState.from('received').inspect(true)).toBe('accepted');
    expect(ReturnState.from('received').inspect(false)).toBe('rejected');
    expect(() => ReturnState.from('intransit').inspect(true)).toThrow('RETURN_STATE_CONFLICT');
  });
});
