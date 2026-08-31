import { describe, expect, it } from 'vitest';
import { signCakeuncle, signCakeuncleCardOrder, signCakeuncleH5, verifyCakeuncleSignature } from '../Signer';

describe('cakeuncle documented signatures', () => {
  it('matches the SHA1 then MD5 API vector', () => {
    const signature = signCakeuncle('channel-test', 'secret-test', '1700000000');
    expect(signature).toBe('748c9a0a8116a2851cc677da6723cc94');
    expect(verifyCakeuncleSignature('channel-test', 'secret-test', '1700000000', signature)).toBe(true);
    expect(verifyCakeuncleSignature('channel-test', 'wrong', '1700000000', signature)).toBe(false);
  });

  it('sorts H5 fields before appending the channel key', () => {
    expect(signCakeuncleH5({ uid: 'user-1', timestamp: 1700000000, channel_no: 'channel-test' }, 'secret-test'))
      .toBe('3f9411c6a60f26d361bf756db48f9a0b');
  });

  it('keeps direct-charge and card-order MD5 field sequences distinct', () => {
    expect(signCakeuncleCardOrder({ action: 'query', merchant: 'm', orderId: 'order-1', quantity: 2,
      account: '13800000000', ip: '127.0.0.1', type: 'type-9' }, 'card-key'))
      .toBe('accc2c32c124cadb536ad7e5fd2c175b');
    expect(signCakeuncleCardOrder({ action: 'query', merchant: 'm', orderId: 'order-1', quantity: 2,
      type: 'type-9' }, 'card-key')).toBe('89bb74085ddbc9f619f71c544a6dcdc5');
  });
});
