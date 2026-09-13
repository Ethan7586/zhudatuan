import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { Component } from './DistributedPlatformRoute';

const server = setupServer(
  http.get('*/api/v1/experiences/applications', () => HttpResponse.json({
    items: [{
      id: 'application:benefits',
      code: 'BENEFITS',
      public_slug: 'benefits',
      name: '鸿泰惠民通',
      status: 'active',
      version: 12,
      head_sequence: 8,
      head_validation_state: 'valid',
      published_sequence: 8,
      domain: 'benefits.example.cn',
      mall_id: 'mall:benefits',
      pool_id: 'pool:benefits',
      updated_at: '2026-08-27T04:00:00.000Z',
    }],
    count: 1,
  })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Distributed platform workspace', () => {
  it('combines the signed node manifest with real mall applications', async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/platforms']}>
        <QueryClientProvider client={client}>
          <ConsoleContextProvider value={context}>
            <Component />
          </ConsoleContextProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: '分布式平台' })).toBeTruthy();
    expect((await screen.findAllByText('node:local-development:l0')).length).toBeGreaterThan(0);
    expect(screen.getByText('NodeManifest')).toBeTruthy();
    expect(screen.getByText('鸿泰惠民通')).toBeTruthy();
    expect(screen.getByRole('button', { name: '树状视图' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: '链路视图' }));
    expect(screen.getByRole('button', { name: '链路视图' }).getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByText('鸿泰惠民通'));
    expect(screen.getAllByText('mall:benefits').length).toBeGreaterThan(0);
    expect(screen.getByText('已经拥有独立商城与 H5 内容；建立独立 NodeManifest、身份入口和发布指针后，才成为完整下级平台。')).toBeTruthy();
  });
});

const scope = { kind: 'mall' as const, id: 'mall:benefits', name: '鸿泰惠民通' };
const context: ConsoleContext = {
  session: {
    actor: 'actor:commerce',
    membership: 'membership:commerce',
    scope,
    scopes: [scope],
    accessVersion: 11,
    permissions: ['experience.application.read'],
    capabilities: ['experience.applications.read'],
    assurance: { level: 2 },
    target: 'console',
    syncedAt: '2026-09-14T00:00:00.000Z',
  },
  profile: { display_name: '商城运营', employee_no: null },
  scope,
  scopes: [scope],
};
