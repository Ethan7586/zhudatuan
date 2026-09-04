import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { renderBrowser, type BrowserRenderOptions, type BrowserRenderResult } from './Render';

export interface RouteRenderOptions extends BrowserRenderOptions {
  readonly initialEntries?: readonly string[];
}

export interface RouteRenderResult extends BrowserRenderResult {
  readonly router: ReturnType<typeof createMemoryRouter>;
}

export function renderRoute(routes: readonly RouteObject[], options: RouteRenderOptions = {}): RouteRenderResult {
  const { initialEntries = ['/'], ...renderOptions } = options;
  const router = createMemoryRouter([...routes], { initialEntries: [...initialEntries] });
  return { ...renderBrowser(<RouterProvider router={router} />, renderOptions), router };
}
