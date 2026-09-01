import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STOREFRONT_WEB_PRESETS } from '../components/laptop/StorefrontWebStandard';
import { DESKTOP_PREVIEW_PROFILES, Desktop1920Preview, DesktopFullViPreview, fitDesktopPreviewScale } from './Desktop1920Preview';

describe('1920 desktop preview', () => {
  it('models a 1920×1080 Windows display at 175% scaling', () => {
    const profile = DESKTOP_PREVIEW_PROFILES.find(({ id }) => id === 'windows-175');

    expect(profile).toMatchObject({ cssWidth: 1097, cssHeight: 617 });
  });

  it('derives the native canvas from the shared Web component standard', () => {
    const native = DESKTOP_PREVIEW_PROFILES.find(({ id }) => id === 'native-100');

    expect(native).toMatchObject({
      cssWidth: STOREFRONT_WEB_PRESETS['desktop-1920'].width,
      cssHeight: STOREFRONT_WEB_PRESETS['desktop-1920'].height,
    });
  });

  it('fits the emulated viewport without enlarging it beyond 1:1', () => {
    expect(fitDesktopPreviewScale(808, 600, { cssWidth: 1097, cssHeight: 617 })).toBeCloseTo(808 / 1097);
    expect(fitDesktopPreviewScale(320, 200, { cssWidth: 1920, cssHeight: 1080 })).toBeCloseTo(320 / 1920);
    expect(fitDesktopPreviewScale(2560, 1440, { cssWidth: 1920, cssHeight: 1080 })).toBe(1);
  });

  it('keeps the frame isolated on the dedicated preview route', () => {
    const markup = renderToStaticMarkup(React.createElement(Desktop1920Preview));

    expect(markup).toContain('src="/desktop-1920/frame"');
    expect(markup).toContain('1920×1080 CSS 原始画布');
    expect(markup).toContain('27英寸 · 175%');
    expect(markup).toContain('预览数据与正式商城后端完全隔离');
  });

  it('uses the complete 1920×1080 VI for the immersive 27-inch route', () => {
    const markup = renderToStaticMarkup(React.createElement(DesktopFullViPreview));

    expect(markup).toContain('title="主打团商城 27英寸完整桌面 VI"');
    expect(markup).toContain('width="1920"');
    expect(markup).toContain('height="1080"');
    expect(markup).toContain('href="/desktop-1920/inspect"');
  });
});
