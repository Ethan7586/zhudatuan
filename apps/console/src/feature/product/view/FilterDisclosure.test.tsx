import { act, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterDisclosure } from './FilterDisclosure';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FilterDisclosure', () => {
  it('keeps filters open on desktop and collapsible on smaller screens', async () => {
    let desktop = true;
    let change: ((event: MediaQueryListEvent) => void) | undefined;
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return desktop;
      },
      media: '(min-width: 1024px)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        change = listener;
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const view = render(
      <FilterDisclosure count={0}>
        <button type="button">应用筛选</button>
      </FilterDisclosure>
    );
    const details = view.container.querySelector('details');
    expect(details?.open).toBe(true);

    desktop = false;
    act(() => change?.({ matches: false } as MediaQueryListEvent));
    expect(details?.open).toBe(false);
    await userEvent.setup().click(view.getByText('筛选商品'));
    expect(details?.open).toBe(true);
  });
});
