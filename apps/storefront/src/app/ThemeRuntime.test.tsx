// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeRuntime } from './ThemeRuntime';

afterEach(cleanup);

describe('ThemeRuntime', () => {
  it.each([
    ['shop', '#1F5EFF', '#19A974'],
    ['market', '#A23B32', '#C99A45'],
    ['governance', '#E8502A', '#F2A65A'],
  ] as const)('maps the %s publication to tokens without forking the component tree', (preset, primaryColor, accentColor) => {
    render(<ThemeRuntime theme={{ preset, primaryColor, accentColor, logoObjectRef: null, faviconObjectRef: null }}><main data-testid="canonical-storefront">商城内容</main></ThemeRuntime>);
    const root = screen.getByText('商城内容').parentElement!;
    expect(root.dataset.storefrontTheme).toBe(preset);
    expect(root.dataset.publishedTheme).toBe('true');
    expect(root.style.getPropertyValue('--storefront-primary')).toBe(primaryColor);
    expect(root.style.getPropertyValue('--storefront-accent')).toBe(accentColor);
    expect(screen.getAllByTestId('canonical-storefront')).toHaveLength(1);
  });

  it('uses the generated design defaults while publication is unavailable', () => {
    render(<ThemeRuntime theme={null}><main>默认商城</main></ThemeRuntime>);
    const root = screen.getByText('默认商城').parentElement!;
    expect(root.dataset.storefrontTheme).toBe('default');
    expect(root.dataset.publishedTheme).toBe('false');
    expect(root.getAttribute('style')).toBeNull();
  });
});
