import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DependencyProvider } from '../../../../app/DependencyContext';
import { createConsoleDependencies } from '../../../../app/Dependencies';
import { ConsoleContextProvider } from '../../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../../entity/session/StepupContext';
import { Component } from './QualificationRoute';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe('QualificationRoute', () => {
  it('previews and publishes an append-only rollback before authoritative reread', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/qualifications', () => {
        reads += 1;
        return HttpResponse.json({ items: [policy], cases: [], count: 1 });
      }),
      http.post('*/api/v1/qualifications/decisions/preview', async ({ request }) => {
        expect(await request.json()).toEqual({ kind: 'rollback', policy: 'policy:one', version: 1 });
        return HttpResponse.json({ kind: 'policy', impact });
      }),
      http.put('*/api/v1/qualifications/policies/:id', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"3"');
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(await request.json()).toEqual({ action: 'rollback', version: 1 });
        return HttpResponse.json({
          id: 'policy:one',
          scope_id: 'mall:one',
          name: '员工策略',
          status: 'published',
          active_version: 4,
          created_at: '2026-09-03T00:00:00.000Z',
          updated_at: '2026-09-03T00:02:00.000Z',
          rule_hash: 'b'.repeat(64),
          action: 'rollback',
          source_version: 1,
        });
      })
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '回滚' }));
    await user.click(screen.getByRole('button', { name: '生成影响预览' }));
    expect(await screen.findByText('将历史 v1 复制为 v4')).toBeTruthy();
    await user.type(screen.getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对目标版本、变化路径、潜在成员和全部关联约束'));
    await user.click(screen.getByRole('button', { name: '确认追加式回滚' }));
    expect(await screen.findByText('回滚版本已发布')).toBeTruthy();
    expect(reads).toBeGreaterThanOrEqual(2);
  });

  it('keeps the existing real decision simulator available', async () => {
    server.use(
      http.get('*/api/v1/qualifications', () => HttpResponse.json({ items: [policy], cases: [], count: 1 })),
      http.post('*/api/v1/qualifications/decisions/preview', () => HttpResponse.json({ kind: 'decision', decisions: [{ policy_id: 'policy:one', policy_version: 3, decision: 'eligible' }] }))
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '模拟决策' }));
    await user.type(screen.getByLabelText('成员标识'), 'member:one');
    await user.type(screen.getByLabelText('商品资源标识'), 'listing:one');
    await user.click(screen.getByRole('button', { name: '开始模拟' }));
    expect(await screen.findByText('符合资格')).toBeTruthy();
  });

  it('keeps preview failures inside the simulator without removing authoritative content', async () => {
    server.use(
      http.get('*/api/v1/qualifications', () => HttpResponse.json({ items: [policy], cases: [], count: 1 })),
      http.post('*/api/v1/qualifications/decisions/preview', () =>
        HttpResponse.json({ code: 'DEPENDENCY_UNAVAILABLE', message: '资格模拟服务暂时不可用。', requestId: 'request:qualification-preview', retryable: true }, { status: 503 })
      )
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '模拟决策' }));
    await user.type(screen.getByLabelText('成员标识'), 'member:one');
    await user.type(screen.getByLabelText('商品资源标识'), 'listing:one');
    await user.click(screen.getByRole('button', { name: '开始模拟' }));
    expect((await screen.findByRole('alert')).textContent).toContain('依赖服务暂时不可用，请稍后重试');
    expect(screen.getByText('员工策略')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: '模拟资格决策' })).toBeTruthy();
  });

  it('uploads, verifies and publishes a real operating qualification before the authoritative reread', async () => {
    let published = false;
    server.use(
      http.get('*/api/v1/qualifications', () => HttpResponse.json({ items: [policy], cases: published ? [qualification] : [], count: 1 })),
      http.post('*/api/v1/qualifications/evidence/uploads', async ({ request }) => {
        const body = await request.json() as { kind: string; sha256: string };
        expect(request.headers.get('idempotency-key')).toBeTruthy();
        return HttpResponse.json({ evidenceId: 'evidence:one', kind: body.kind, objectId: 'object:license-one', sha256: body.sha256, upload: { url: 'https://objects.test/qualification/license', method: 'PUT', headers: { 'content-type': 'application/pdf' }, expiresAt: '2099-09-05T00:00:00.000Z' } });
      }),
      http.put('https://objects.test/qualification/license', ({ request }) => {
        expect(request.credentials).toBe('omit');
        return new HttpResponse(null, { status: 204 });
      }),
      http.put('*/api/v1/qualifications/:id/publish', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"0"');
        expect(request.headers.get('x-action-proof')).toBe('p'.repeat(43));
        expect(await request.json()).toMatchObject({ title: '食品经营许可证', subject: { kind: 'partner', id: 'partner:one' }, applicability: [{ kind: 'category', id: 'category:food' }], evidence: [{ id: 'evidence:one', kind: 'license', reference: 'object:license-one' }] });
        published = true;
        return HttpResponse.json(qualification);
      })
    );
    renderRoute();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '发布经营资质' }));
    await user.type(screen.getByLabelText('资质名称'), '食品经营许可证');
    await user.type(screen.getByLabelText('持证主体标识'), 'partner:one');
    await user.type(screen.getByRole('textbox', { name: /适用对象/ }), 'category:food');
    await user.upload(screen.getByLabelText('选择材料'), new File(['license'], 'license.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/已上传：license\.pdf/)).toBeTruthy();
    await user.type(screen.getByLabelText('一次性操作凭证'), 'p'.repeat(43));
    await user.click(screen.getByLabelText('我已核对材料、持证主体、适用对象和有效期，并理解该操作的业务影响'));
    await user.click(screen.getByRole('button', { name: '核验材料并发布' }));
    expect(await screen.findByText('经营资质已发布')).toBeTruthy();
    expect(await screen.findByText('食品经营许可证')).toBeTruthy();
  });
});

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DependencyProvider value={createConsoleDependencies()}>
          <ConsoleContextProvider value={context}>
            <StepupProvider controller={{ request: () => undefined }}>
              <Component />
            </StepupProvider>
          </ConsoleContextProvider>
        </DependencyProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const policy = {
  id: 'policy:one',
  name: '员工策略',
  status: 'published',
  active_version: 3,
  updated_at: '2026-09-03T00:01:00.000Z',
  rule: { effect: 'allow', requiredTags: ['employee'] },
  rule_hash: 'a'.repeat(64),
  published_at: '2026-09-03T00:01:00.000Z',
  versions: [
    { version: 3, rule_hash: 'a'.repeat(64), published_at: '2026-09-03T00:01:00.000Z', created_by: 'membership:one' },
    { version: 1, rule_hash: 'b'.repeat(64), published_at: '2026-08-01T00:00:00.000Z', created_by: 'membership:one' },
  ],
};
const impact = {
  action: 'rollback',
  policy_id: 'policy:one',
  current_version: 3,
  next_version: 4,
  source_version: 1,
  current_hash: 'a'.repeat(64),
  proposed_hash: 'b'.repeat(64),
  changed_fields: ['versionSnapshot', 'requiredTags'],
  potential_profiles: 120,
  resource_count: 8,
  subject_count: 2,
  limit_count: 4,
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['qualification.read', 'qualification.preview', 'qualification.manage'],
    capabilities: ['qualification.center.read', 'qualification.decisions.preview', 'qualification.policies.manage', 'qualification.qualifications.publish', 'qualification.qualifications.revoke', 'qualification.evidenceuploads.create'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};

const qualification = {
  id: 'qualification:one',
  title: '食品经营许可证',
  subject_kind: 'partner',
  subject_id: 'partner:one',
  state: 'published',
  version: 1,
  effective_at: '2026-09-05T00:00:00.000Z',
  expires_at: '2099-09-30T00:00:00.000Z',
  reviewed_at: '2026-09-05T00:00:00.000Z',
  published_at: '2026-09-05T00:00:00.000Z',
  revoked_at: null,
  revoke_reason: null,
  evidence_count: 1,
  applicability: [{ kind: 'category', id: 'category:food' }],
};
