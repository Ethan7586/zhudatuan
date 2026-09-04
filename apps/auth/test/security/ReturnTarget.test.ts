import { describe, expect, it } from 'vitest';
import { approvedDestination, authTargetSearch, readSessionRequest } from '../../src/shared/security/ReturnTarget';

describe('return target security', () => {
  const origins = {
    console: 'https://console.example.com',
    storefront: 'https://store.example.com',
    miniapp: 'https://miniapp.example.com',
    store: 'https://workbench.example.com',
    supplier: 'https://supplier.example.com',
  } as const;

  it('accepts a normalized relative return path and a single known target', () => {
    expect(readSessionRequest({ search: '?target=console&returnpath=%2Forders%3Fstatus%3Dpaid' })).toEqual({ target: 'console', returnPath: '/orders?status=paid' });
    expect(readSessionRequest({ search: '?target=miniapp' })).toEqual({ target: 'miniapp' });
    expect(readSessionRequest({ search: '?target=store' })).toEqual({ target: 'store' });
    expect(readSessionRequest({ search: '?target=supplier' })).toEqual({ target: 'supplier' });
  });

  it.each([
    '?target=console&target=storefront',
    '?target=unknown',
    '?returnpath=https%3A%2F%2Fattacker.example',
    '?returnpath=%2F%2Fattacker.example',
    '?returnpath=%2Forders%5Cnext',
  ])('rejects duplicate or unsafe query input: %s', (search) => {
    expect(() => readSessionRequest({ search })).toThrow('RETURN_TARGET_INVALID');
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
