// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/app/App';
import { bootstrapOutput } from '../TestData';

describe('Auth application', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the password MVP after bootstrap while provider loading degrades independently', async () => {
    window.history.replaceState({}, '', '/?target=storefront');
    vi.stubGlobal('fetch', vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('/identity/bootstrap')) return json(bootstrapOutput());
      if (url.includes('/identity/providers')) return json({ items: 'invalid' });
      throw new Error('UNEXPECTED_TEST_REQUEST');
    }));
    render(<App />);
    expect(screen.getByText('正在初始化安全登录…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '统一账号认证' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '登录' })).toBeTruthy();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}
