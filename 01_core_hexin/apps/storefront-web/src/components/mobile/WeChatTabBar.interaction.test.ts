// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({
  prepareCart: vi.fn(),
  preload: vi.fn(),
  setMpPage: vi.fn(),
}));

vi.mock('../../context/MallContext', () => ({
  useMall: () => ({ cartCount: 3, mpPage: 'category', prepareCart: controls.prepareCart, setMpPage: controls.setMpPage }),
}));
vi.mock('./miniProgramPageLoaders', () => ({ preloadMiniProgramPage: controls.preload }));

import { WeChatTabBar } from './WeChatTabBar';

afterEach(() => cleanup());

describe('cart tab warm-up', () => {
  it('starts both code and data preparation on pointer down', () => {
    const { getByRole } = render(React.createElement(WeChatTabBar));
    fireEvent.pointerDown(getByRole('button', { name: /购物车/ }));
    expect(controls.preload).toHaveBeenCalledWith('cart');
    expect(controls.prepareCart).toHaveBeenCalledTimes(1);
  });
});
