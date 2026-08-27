import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STOREFRONT_WEB_PAGES, STOREFRONT_WEB_PRESETS, STOREFRONT_WEB_STANDARD_ID, defaultStorefrontWebPage, storefrontDeviceSwitchPolicy } from './StorefrontWebStandard';

const componentRoot = dirname(fileURLToPath(import.meta.url));

describe('consumer storefront Web component standard', () => {
  it('publishes one versioned component family for all supported Web viewports', () => {
    expect(STOREFRONT_WEB_STANDARD_ID).toBe('smart-wing-storefront-web-v1');
    expect(Object.keys(STOREFRONT_WEB_PRESETS)).toEqual(['laptop-1366', 'laptop-1440', 'desktop-1920']);
    expect(STOREFRONT_WEB_PAGES).toEqual(['home-1366', 'home-1440', 'category', 'detail', 'cart', 'orders']);
  });

  it('registers the 27-inch canvas without creating a second page family', () => {
    expect(STOREFRONT_WEB_PRESETS['desktop-1920']).toMatchObject({
      surface: 'desktop-1920',
      width: 1920,
      height: 1080,
      defaultPage: 'home-1440',
    });
    expect(defaultStorefrontWebPage('desktop-1920')).toBe('home-1440');
    expect(defaultStorefrontWebPage('laptop')).toBe('home-1366');
  });

  it('keeps Desktop switching inside the current multi-device entry', () => {
    const switcherSources = [readFileSync(resolve(componentRoot, 'LaptopTopSwitcher.tsx'), 'utf8'), readFileSync(resolve(componentRoot, '../mobile/MobileTopBarSwitcher.tsx'), 'utf8')];

    switcherSources.forEach((source) => {
      expect(source).not.toContain('href="/desktop-1920"');
      expect(source).toContain("handleSwitchMode('pc', true)");
    });
  });

  it('keeps the production root on the authoritative storefront while preserving six Web page controls', () => {
    const productionRoot = readFileSync(resolve(componentRoot, '../../StorefrontRoot.tsx'), 'utf8');

    expect(productionRoot).toContain('navigationBoundary="production"');
    expect(productionRoot).toContain("appMode === 'pc' ? 'desktop-1920' : 'laptop'");
    expect(storefrontDeviceSwitchPolicy('production', 'laptop-web')).toEqual({ disabled: false, preservePath: true });
    expect(storefrontDeviceSwitchPolicy('production', 'pc')).toEqual({ disabled: false, preservePath: true });
    expect(storefrontDeviceSwitchPolicy('production', 'mini-program')).toEqual({ disabled: true, preservePath: true });
    expect(storefrontDeviceSwitchPolicy('production', 'android-app')).toEqual({ disabled: true, preservePath: true });
    expect(storefrontDeviceSwitchPolicy('production', 'tablet-app')).toEqual({ disabled: true, preservePath: true });
    expect(storefrontDeviceSwitchPolicy('showcase', 'mini-program')).toEqual({ disabled: false, preservePath: false });
  });
});
