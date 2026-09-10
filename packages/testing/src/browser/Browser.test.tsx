// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useParams } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNoA11yViolations, auditA11y } from './A11y';
import { createMswHarness } from './Msw';
import { renderRoute } from './Router';

afterEach(cleanup);

describe('browser harness', () => {
  it('renders a deep link with query and user providers', async () => {
    function Product() {
      const { productId } = useParams();
      return <button type="button">商品 {productId}</button>;
    }

    const result = renderRoute([{ path: '/products/:productId', element: <Product /> }], {
      initialEntries: ['/products/P100?scope=store'],
    });
    await result.user.click(screen.getByRole('button', { name: '商品 P100' }));
    expect(result.router.state.location.search).toBe('?scope=store');
    assertNoA11yViolations(await auditA11y(result.container, { rules: { 'color-contrast': { enabled: false } } }));
  });

  it('serves declared MSW handlers', async () => {
    const msw = createMswHarness(http.get('https://console.yengze.press/api/health', () => HttpResponse.json({ ok: true })));
    msw.start();
    try {
      const response = await fetch('https://console.yengze.press/api/health');
      await expect(response.json()).resolves.toEqual({ ok: true });
    } finally {
      msw.reset();
      msw.stop();
    }
  });
});
