import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DependencyProvider } from '../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { readActionRequest } from '../../../shared/security/ActionRequest';
import { Component } from './route/AccessRoute';

const server = setupServer(
  http.get('*/api/v1/access/center', () =>
    HttpResponse.json({
      items: [
        {
          id: 'membership:internal-value',
          display_name: '张三',
          employee_no: 'E1001',
          mobile_masked: '138****0000',
          client: 'console',
          status: 'active',
          access_version: 3,
          roles: [{ role: 'role:self', name: 'Self Service', kind: 'system', version: 1, allows: [], denies: [] }],
          scopes: [],
          overrides: [],
        },
      ],
      count: 1,
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('access center account presentation', () => {
  it('shows the account name and human account label without exposing the membership id', async () => {
    renderRoute(vi.fn());

    expect(await screen.findByText('张三')).toBeTruthy();
    expect(screen.getByText('员工号 E1001')).toBeTruthy();
    expect(screen.getByText('自助服务')).toBeTruthy();
    expect(screen.queryByText('Self Service')).toBeNull();
    expect(screen.queryByText('membership:internal-value')).toBeNull();
  });

  it('turns STEPUP_REQUIRED into the shared Chinese verification flow', async () => {
    const request = vi.fn();
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json({ code: 'STEPUP_REQUIRED', message: 'STEPUP_REQUIRED', requestId: 'request:access', retryable: false }, { status: 403 })));
    renderRoute(request);

    const action = await screen.findByRole('button', { name: '立即完成二次验证' });
    expect(screen.getByText(/管理员账号、角色和项目范围属于敏感信息/)).toBeTruthy();
    expect(screen.queryByText(/request:access/)).toBeNull();
    fireEvent.click(action);
    expect(request).toHaveBeenCalledOnce();
  });

  it('requires step-up before preparing an owner transfer', async () => {
    const request = vi.fn();
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(request, true, 2);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '转移所有权' }));
    await user.type(screen.getByLabelText('转移原因'), '负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '立即完成二次验证' }));
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '确认转移所有权' }).disabled).toBe(true);
  });

  it('binds the maker-checker request to owner operation, current version and maker', async () => {
    server.use(http.get('*/api/v1/access/center', () => HttpResponse.json(ownerPage())));
    renderRoute(vi.fn(), true, 3);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '转移所有权' }));
    await user.type(screen.getByLabelText('转移原因'), '负责人岗位调整');
    await user.click(screen.getByRole('button', { name: '生成复核请求码' }));
    const encoded = await screen.findByLabelText('复核请求码');
    expect(readActionRequest((encoded as HTMLTextAreaElement).value)).toMatchObject({ operation: 'access.owners.transfer', resource: 'mall:one', expectedVersion: 11, makerMembership: 'membership:owner' });
  });
});

function renderRoute(request: () => void, privileged = false, level = 2) {
  const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
  const context: ConsoleContext = {
    session: {
      actor: 'principal:one',
      membership: 'membership:owner',
      accessVersion: 7,
      permissions: privileged ? ['access.center.read', 'access.owner.transfer'] : ['access.center.read'],
      capabilities: privileged ? ['access.center.read', 'access.owners.transfer'] : ['access.center.read'],
      target: 'console',
      scope,
      scopes: [scope],
      assurance: { level },
      security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null },
      syncedAt: '2026-09-03T00:00:00Z',
      csrf: 'csrf',
    },
    profile: { display_name: '管理员', employee_no: 'A001' },
    scope,
    scopes: [scope],
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <StepupProvider controller={{ request }}>
            <DependencyProvider value={createConsoleDependencies()}>
              <Component />
            </DependencyProvider>
          </StepupProvider>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function ownerPage() {
  return {
    items: [
      {
        id: 'membership:owner',
        display_name: '当前负责人',
        employee_no: 'A001',
        mobile_masked: '138****0000',
        client: 'console',
        status: 'active',
        access_version: 11,
        roles: [{ role: 'role:owner', name: 'Owner', kind: 'owner', version: 5, allows: [], denies: [] }],
        scopes: [],
        overrides: [],
      },
      { id: 'membership:next', display_name: '新负责人', employee_no: 'A002', mobile_masked: '139****0000', client: 'console', status: 'active', access_version: 9, roles: [], scopes: [], overrides: [] },
    ],
    count: 2,
  };
}
