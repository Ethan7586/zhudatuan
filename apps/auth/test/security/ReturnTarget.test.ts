import { describe, expect, it } from 'vitest';
import { approvedDestination, authTargetSearch, readAuthRequest } from '../../src/shared/security/ReturnTarget';

describe('return target security', () => {
  const origins = { console: 'https://console.example.com', storefront: 'https://store.example.com' } as const;

  it('accepts a normalized relative return path and a single known target', () => {
    expect(readAuthRequest({ search: '?target=console&returnpath=%2Forders%3Fstatus%3Dpaid' })).toEqual({ target: 'console', returnPath: '/orders?status=paid' });
  });

  it.each([
    '?target=console&target=storefront',
    '?returnpath=https%3A%2F%2Fattacker.example',
    '?returnpath=%2F%2Fattacker.example',
    '?returnpath=%2Forders%5Cnext',
  ])('rejects duplicate or unsafe query input: %s', (search) => {
    expect(() => readAuthRequest({ search })).toThrow('RETURN_TARGET_INVALID');
  });

  it('allows only HTTPS configured origins, with loopback HTTP limited to development', () => {
    expect(approvedDestination('https://store.example.com/orders', 'storefront', origins)).toBe('https://store.example.com/orders');
    expect(() => approvedDestination('https://attacker.example/orders', 'storefront', origins)).toThrow('RETURN_TARGET_INVALID');
    expect(() => approvedDestination('http://store.example.com/orders', 'storefront', { ...origins, storefront: 'http://store.example.com' })).toThrow('RETURN_TARGET_INVALID');
    expect(approvedDestination('http://127.0.0.1:3000/orders', 'storefront', { ...origins, storefront: 'http://127.0.0.1:3000' })).toBe('http://127.0.0.1:3000/orders');
  });

  it('drops a return target when the user changes application target', () => {
    expect(authTargetSearch('?target=storefront&returntarget=signed&returnpath=%2Forders', 'console')).toBe('?target=console');
  });
});
