import { describe, expect, it } from 'vitest';
import tokens from '../../../../../packages/design-system/src/tokens.json';
import { MOBILE_NAVIGATION, mobilePlatformFromUserAgent } from './MobileBottomNav';

describe('mobile storefront navigation', () => {
  it('uses the frozen member-code navigation labels in order', () => {
    expect(MOBILE_NAVIGATION.map(({ label }) => label)).toEqual(tokens.wingCode.navigation);
  });

  it('keeps cart out of the five primary destinations', () => {
    expect(MOBILE_NAVIGATION).toHaveLength(5);
    expect(MOBILE_NAVIGATION.some(({ key }) => key === 'cart')).toBe(false);
  });

  it('selects the platform geometry from the browser user agent', () => {
    expect(mobilePlatformFromUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe('android');
    expect(mobilePlatformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('ios');
  });
});
