import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { FeatureRouteError } from './RouteError';
import { routeResponse } from './RouteResponse';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FeatureRouteError', () => {
  it('keeps the shell usable when one feature render fails and hides the raw error', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        element: <ShellFixture />,
        children: [{ index: true, Component: BrokenFeature, ErrorBoundary: FeatureRouteError }],
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('控制台导航仍可使用')).toBeTruthy();
    expect(screen.getByText('仅当前功能区域受到影响，导航和其他页面仍可使用。')).toBeTruthy();
    expect(screen.queryByText(/database password/iu)).toBeNull();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeTruthy();
  });

  it('renders a standard Chinese permission explanation with a safe fallback action', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <ShellFixture />,
          children: [
            {
              path: 'secured',
              loader: () => {
                throw routeResponse('PERMISSION_DENIED');
              },
              Component: EmptyFeature,
              ErrorBoundary: FeatureRouteError,
            },
          ],
        },
      ],
      { initialEntries: ['/secured'] }
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: '当前页面不可用' })).toBeTruthy();
    expect(screen.getByText('当前身份没有执行此操作的权限。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返回可用工作台' })).toBeTruthy();
    expect(screen.queryByText('PERMISSION_DENIED')).toBeNull();
  });
});

function ShellFixture() {
  return (
    <main>
      <nav>控制台导航仍可使用</nav>
      <Outlet />
    </main>
  );
}

function BrokenFeature(): never {
  throw new Error('database password must never be shown');
}

function EmptyFeature() {
  return <span />;
}
