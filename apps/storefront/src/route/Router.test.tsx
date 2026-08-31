import { describe, expect, it } from 'vitest';
import { pathToPage, routeForPage, routePath, ROUTES } from './Routes';

describe('storefront router', () => {
  it('maps every deep-link family to its canonical presentation', () => {
    expect(pathToPage('/')).toBe('home-1366');
    expect(pathToPage('/products')).toBe('category');
    expect(pathToPage('/products/listing:one')).toBe('detail');
    expect(pathToPage('/checkout')).toBe('cart');
    expect(pathToPage('/orders/order:one')).toBe('orders');
    expect(routeForPage('orders')).toBe(ROUTES.orders);
  });

  it('encodes valid route parameters and rejects unsafe values', () => {
    expect(routePath('product', 'listing:one')).toBe('/products/listing%3Aone');
    expect(() => routePath('product', '../')).toThrow('ROUTE_PARAMETER_INVALID');
    expect(() => routePath('order')).toThrow('ROUTE_PARAMETER_INVALID');
  });
});
