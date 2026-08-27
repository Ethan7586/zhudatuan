import { describe, expect, it } from 'vitest';
import { laptopPageFromPath, modeFromPath } from './useDeviceNavigation';

describe('device navigation initial mode', () => {
  it.each([
    ['/mini-program', 'mini-program'],
    ['/android-app', 'android-app'],
    ['/tablet-app', 'tablet-app'],
    ['/laptop-web', 'laptop-web'],
    ['/desktop-1920', 'pc'],
    ['/desktop-1920/frame', 'pc'],
    ['/', 'pc'],
    ['/unknown-device', 'pc'],
  ] as const)('maps %s to %s on both server and browser renders', (path, expected) => {
    expect(modeFromPath(path)).toBe(expected);
  });

  it('opens the shared wide home on 27-inch desktop without changing laptop defaults', () => {
    expect(laptopPageFromPath('/desktop-1920/frame')).toBe('home-1440');
    expect(laptopPageFromPath('/laptop-web')).toBe('home-1366');
  });
});
