import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DevicePage from '../../app/[device]/page';
import Desktop1920FramePage from '../../app/desktop-1920/frame/page';
import { DeviceShowcase, isSupportedShowcasePath, resolveShowcaseSurface } from './DeviceShowcase';

function renderShowcaseShell(initialPath: string) {
  return renderToStaticMarkup(React.createElement(DeviceShowcase, { initialPath }));
}

describe('device showcase hydration contract', () => {
  it.each(['/desktop-1920/frame', '/mini-program', '/android-app', '/tablet-app', '/laptop-web', '/unknown-device'])(
    'renders the same server and browser-first shell for %s',
    (initialPath) => {
      const markup = renderShowcaseShell(initialPath);

      expect(markup).toBe(renderShowcaseShell('/'));
      expect(markup).toContain('aria-busy="true"');
      expect(markup).toContain('aria-label="正在载入多端展示"');
      expect(markup).not.toContain('该展示入口不存在');
    },
  );

  it('passes the dynamic device route into the client showcase', async () => {
    const element = await DevicePage({ params: Promise.resolve({ device: 'mini-program' }) });

    expect(React.isValidElement(element)).toBe(true);
    expect((element.props as { initialPath: string }).initialPath).toBe('/mini-program');
  });

  it('keeps unknown wildcard routes out of the desktop preview', () => {
    expect(isSupportedShowcasePath('/desktop-1920/frame')).toBe(true);
    expect(isSupportedShowcasePath('/unknown-device')).toBe(false);
  });

  it('uses one storefront Web component family for laptop and 27-inch desktop', () => {
    expect(resolveShowcaseSurface('/laptop-web')).toEqual({ family: 'storefront-web', surface: 'laptop' });
    expect(resolveShowcaseSurface('/desktop-1920/frame')).toEqual({ family: 'storefront-web', surface: 'desktop-1920' });
    expect(resolveShowcaseSurface('/unknown-device')).toBeNull();
  });

  it('pins the isolated desktop iframe to the 27-inch frame route', () => {
    const element = Desktop1920FramePage();

    expect(React.isValidElement(element)).toBe(true);
    expect((element.props as { initialPath: string }).initialPath).toBe('/desktop-1920/frame');
  });
});
