import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component } from './ChannelRoute';

const server = setupServer(
  http.get('*/api/v1/channels/connections', ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:one');
    return HttpResponse.json({ items: [connection()], count: 1 });
  })
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('Channel route', () => {
  it('assembles the injected gateway and exposes only valid state transitions', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <DependencyProvider value={createConsoleDependencies()}>
            <ConsoleContextProvider value={context}>
              <StepupProvider controller={{ request: vi.fn() }}>
                <Component />
              </StepupProvider>
            </ConsoleContextProvider>
          </DependencyProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    expect(await screen.findByText('京东')).toBeTruthy();
    expect(screen.getByRole('button', { name: '创建连接' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '真实测试' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '启用' })).toBeNull();
    expect(screen.getByText('密钥引用已配置')).toBeTruthy();
  });
});

const permissions = ['channel.connection.read', 'channel.connection.manage', 'channel.sync.read', 'channel.sync.manage', 'channel.operation.read', 'channel.operation.replay'];
const capabilities = [
  'channel.connections.read',
  'channel.connections.create',
  'channel.connections.update',
  'channel.connections.test',
  'channel.connections.enable',
  'channel.connections.disable',
  'channel.syncruns.read',
  'channel.syncruns.start',
  'channel.syncruns.cancel',
  'channel.operations.read',
  'channel.operations.replay',
];
const context = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions,
    capabilities,
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:one' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:one' }],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token-value',
    syncedAt: '2026-09-03T00:00:00Z',
  },
  profile: { display_name: '运营', employee_no: null },
  scope: { kind: 'enterprise', id: 'enterprise:one' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:one' }],
} as ConsoleContext;
function connection() {
  return {
    id: 'connection:one',
    provider: 'jdproduct',
    scope_id: 'enterprise:one',
    status: 'draft',
    contract_version: 'jdproduct.v1',
    region: 'cn',
    connection_timeout_ms: 1000,
    response_timeout_ms: 2000,
    total_deadline_ms: 3000,
    max_concurrency: 4,
    requests_per_second: 5,
    max_attempts: 3,
    failure_threshold: 5,
    recovery_ms: 30000,
    version: 6,
    created_at: '2026-09-03T00:00:00.000Z',
    updated_at: '2026-09-03T00:01:00.000Z',
    has_secret: true,
  };
}
