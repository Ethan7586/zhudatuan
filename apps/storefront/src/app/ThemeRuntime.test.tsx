// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeRuntime } from './ThemeRuntime';

afterEach(cleanup);

describe('ThemeRuntime', () => {
  it('maps a published theme to scoped design tokens without another component tree', () => {
    render(<ThemeRuntime theme={{ preset: 'governance', primaryColor: '#2457C5', accentColor: '#E67E22', logoObjectRef: null, faviconObjectRef: null }}><main>商城内容</main></ThemeRuntime>);
    const root = screen.getByText('商城内容').parentElement!;
    expect(root.dataset.storefrontTheme).toBe('governance');
    expect(root.dataset.publishedTheme).toBe('true');
    expect(root.style.getPropertyValue('--storefront-primary')).toBe('#2457C5');
    expect(root.style.getPropertyValue('--storefront-accent')).toBe('#E67E22');
  });

  it('uses the generated design defaults while publication is unavailable', () => {
    render(<ThemeRuntime theme={null}><main>默认商城</main></ThemeRuntime>);
    const root = screen.getByText('默认商城').parentElement!;
    expect(root.dataset.storefrontTheme).toBe('default');
    expect(root.dataset.publishedTheme).toBe('false');
    expect(root.getAttribute('style')).toBeNull();
  });
});
