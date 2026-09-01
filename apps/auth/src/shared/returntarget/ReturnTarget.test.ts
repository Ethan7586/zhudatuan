import { describe, expect, it } from 'vitest';
import { authTargetSearch, readAuthRequest } from './ReturnTarget';

describe('authentication target', () => {
  it('defaults invalid or missing targets to the storefront', () => {
    expect(readAuthRequest({ search: '' })).toEqual({ target: 'storefront' });
    expect(readAuthRequest({ search: '?target=unknown' })).toEqual({ target: 'storefront' });
  });

  it('reads the explicitly selected console and its signed return handle', () => {
    expect(readAuthRequest({ search: '?target=console&returntarget=signed-handle' })).toEqual({ target: 'console', returnTarget: 'signed-handle' });
  });

  it('keeps a storefront entry path until the API replaces it with a signed target', () => {
    expect(readAuthRequest({ search: '?target=storefront&returnpath=%2Fs%2Fmall-one%2Forders' })).toEqual({ target: 'storefront', returnPath: '/s/mall-one/orders' });
    expect(readAuthRequest({ search: '?target=storefront&returntarget=signed&returnpath=%2Fs%2Fmall-one' })).toEqual({ target: 'storefront', returnTarget: 'signed' });
  });

  it('drops a target-bound return handle whenever the user changes destination', () => {
    expect(authTargetSearch('?target=console&returntarget=signed-handle&returnpath=%2Fs%2Fmall-one&campaign=benefits', 'storefront')).toBe('?target=storefront&campaign=benefits');
  });
});
