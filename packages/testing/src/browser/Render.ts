import type { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { createTestQueryClient, QueryHarness } from './Query';
import { createUser, type BrowserUser } from './User';

export interface BrowserRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  readonly queryClient?: QueryClient;
}

export interface BrowserRenderResult extends RenderResult {
  readonly queryClient: QueryClient;
  readonly user: BrowserUser;
}

export function renderBrowser(view: ReactElement, options: BrowserRenderOptions = {}): BrowserRenderResult {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) => createElement(QueryHarness, { client: queryClient, children });
  return { ...render(view, { ...renderOptions, wrapper: Wrapper }), queryClient, user: createUser() };
}
