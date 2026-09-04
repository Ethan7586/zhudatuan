import { describe, expect, it } from 'vitest';
import { providerCatalog } from './ProviderCatalog';

describe('providerCatalog', () => {
  it('preserves the server credential order and hides federated providers when federation is unavailable', () => {
    const provider = Object.freeze({ id: 'wechat-main', type: 'wechat' as const });
    expect(providerCatalog(['otp', 'password'], [provider])).toEqual({ credentials: ['otp', 'password'], federations: [] });
  });

  it('publishes only providers returned by the generated provider operation', () => {
    const providers = Object.freeze([
      Object.freeze({ id: 'wechat-main', type: 'wechat' as const }),
      Object.freeze({ id: 'work-main', type: 'wecomcorp' as const }),
    ]);
    expect(providerCatalog(['password', 'federation'], providers)).toEqual({ credentials: ['password'], federations: providers });
  });
});
