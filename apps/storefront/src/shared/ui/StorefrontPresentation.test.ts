import { describe, expect, it } from 'vitest';
import { STOREFRONT_WEB_PAGES, STOREFRONT_WEB_PRESETS, STOREFRONT_WEB_STANDARD_ID, defaultStorefrontWebPage } from './StorefrontPresentation';

describe('consumer storefront responsive component standard', () => {
  it('publishes one versioned component family for the MVP Web client', () => {
    expect(STOREFRONT_WEB_STANDARD_ID).toBe('shop-storefront-standard-v2');
    expect(Object.keys(STOREFRONT_WEB_PRESETS)).toEqual(['standard-1366', 'wide-1440']);
    expect(STOREFRONT_WEB_PAGES).toEqual(['home-1366', 'home-1440', 'category', 'detail', 'cart', 'orders']);
  });

  it('uses Web-only presets without device routes', () => {
    expect(STOREFRONT_WEB_PRESETS['wide-1440']).toMatchObject({ surface: 'wide', width: 1440, height: 900, defaultPage: 'home-1440' });
    expect(defaultStorefrontWebPage('wide')).toBe('home-1440');
    expect(defaultStorefrontWebPage('standard')).toBe('home-1366');
  });
});
