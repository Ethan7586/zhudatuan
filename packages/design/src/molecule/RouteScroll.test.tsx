// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteScroll } from './RouteScroll';

afterEach(() => vi.restoreAllMocks());

describe('RouteScroll', () => {
  it('restores each history entry and keeps new entries at the top', () => {
    let offset = 0;
    const scroll = vi.fn((options: ScrollToOptions) => {
      offset = options.top ?? 0;
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => offset });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scroll });
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { callback(0); return 1; } });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() });

    const view = render(<RouteScroll entry="history:first" />);
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
    offset = 240;
    view.rerender(<RouteScroll entry="history:second" />);
    expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
    offset = 80;
    view.rerender(<RouteScroll entry="history:first" />);
    expect(scroll).toHaveBeenLastCalledWith({ top: 240, behavior: 'auto' });
  });
});
