import { describe, expect, it } from 'vitest';
import { authTargetSearch, readAuthRequest } from './ReturnTarget';

describe('authentication target', () => {
  it('defaults invalid or missing targets to the storefront', () => {
    expect(readAuthRequest({ search: '' })).toEqual({ target: 'storefront' });
    expect(readAuthRequest({ search: '?target=unknown' })).toEqual({ target: 'storefront' });
  });

  it('reads the explicitly selected console and its signed return handle', () => {
    expect(readAuthRequest({ search: '?target=console&returntarget=signed-handle' })).toEqual({ target: 'console', handle: 'signed-handle' });
  });

  it('drops a target-bound return handle whenever the user changes destination', () => {
    expect(authTargetSearch('?target=console&returntarget=signed-handle&campaign=benefits', 'storefront')).toBe('?target=storefront&campaign=benefits');
  });
});
