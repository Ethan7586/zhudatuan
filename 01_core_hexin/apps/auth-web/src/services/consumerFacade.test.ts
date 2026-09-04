import { describe, expect, it } from 'vitest';
import { resolveConsumerFacadeOrigin } from './consumerFacade';

describe('consumer account façade', () => {
  it('uses the current L1 origin only for the mounted consumer account route', () => {
    expect(resolveConsumerFacadeOrigin({ origin: 'https://merchant.example', pathname: '/accounts/' }))
      .toBe('https://merchant.example');
    expect(resolveConsumerFacadeOrigin({ origin: 'https://merchant.example', pathname: '/accounts/assets/app.js' }))
      .toBe('https://merchant.example');
    expect(resolveConsumerFacadeOrigin({ origin: 'https://accounts.zhudatuan.com', pathname: '/' }))
      .toBeUndefined();
  });
});
