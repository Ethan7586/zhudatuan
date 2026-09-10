import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './FederationRoute';

const provider = { id: '00000000-0000-4000-8000-000000000001', type: 'oidc', status: 'enabled' };
const server = setupServer(http.get('*/api/v1/identity/providers/center', () => HttpResponse.json({ items: [provider], count: 1 })));
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('FederationRoute', () => {
  it('offers security upgrade instead of a fake disabled health action', async () => {
    const request = vi.fn();
    renderRoute(context(2), request);
    const action = await screen.findByRole('button', { name: '验证后健康检查' });
    fireEvent.click(action);
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByText('密钥')).toBeTruthy();
    expect(screen.getByText('企业统一身份账号')).toBeTruthy();
    expect(screen.queryByText(provider.id)).toBeNull();
    expect(screen.queryByText(/secret/i)).toBeNull();
  });

  it('executes the real health endpoint after step-up', async () => {
    server.use(http.post('*/api/v1/identity/providers/:id/tests', () => HttpResponse.json({ status: 'healthy', checkedat: '2026-09-03T00:00:00.000Z' })));
    renderRoute(context(3), vi.fn());
    fireEvent.click(await screen.findByRole('button', { name: '执行真实健康检查' }));
    expect(await screen.findByText('连接健康')).toBeTruthy();
  });

  it('keeps a failed health check local while preserving the provider card', async () => {
    server.use(
      http.post('*/api/v1/identity/providers/:id/tests', () =>
        HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', message: '身份服务商暂时不可用。', requestId: 'request:federation-test', retryable: true }, { status: 503 })
      )
    );
    renderRoute(context(3), vi.fn());
    fireEvent.click(await screen.findByRole('button', { name: '执行真实健康检查' }));
    expect((await screen.findByRole('alert')).textContent).toContain('依赖服务暂时不可用，请稍后重试');
    expect(screen.getByRole('heading', { name: 'OIDC 统一身份登录' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '执行真实健康检查' })).toBeTruthy();
  });
});

function renderRoute(value: ConsoleContext, request: () => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={value}>
            <StepupProvider controller={{ request }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
function context(level: number): ConsoleContext {
  const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
  return {
    session: {
      actor: 'actor:one',
      membership: 'membership:one',
      accessVersion: 7,
      permissions: ['identity.provider.read', 'identity.provider.manage', 'identity.provider.test'],
      capabilities: ['identity.providers.center.read', 'identity.providers.test'],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
      csrf: 'csrf-token',
      syncedAt: '2026-09-03T00:00:00.000Z',
    },
    profile: { display_name: '管理员', employee_no: null },
    scope,
    scopes: [scope],
  };
}
