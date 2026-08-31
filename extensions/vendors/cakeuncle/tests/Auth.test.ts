import { describe, expect, it } from 'vitest';
import { createCakeuncleAuth } from '../Auth';

describe('cakeuncle authentication contract', () => {
  it('fails closed when a signed secret field is absent', () => {
    expect(() => createCakeuncleAuth({})).toThrow();
    expect(() => createCakeuncleAuth({ channelNo: 'channel' })).toThrow('CAKEUNCLE_CHANNEL_KEY_MISSING');
  });

  it('uses Secret Store field names instead of generic HMAC aliases', () => {
    expect(createCakeuncleAuth({ channelNo: ' channel ', channelKey: ' key ', userId: ' user ' }))
      .toEqual({ channelNo: 'channel', channelKey: 'key', userId: 'user' });
    expect(() => createCakeuncleAuth({ keyId: 'channel', secret: 'key' })).toThrow('CAKEUNCLE_CHANNEL_NO_MISSING');
  });
});
