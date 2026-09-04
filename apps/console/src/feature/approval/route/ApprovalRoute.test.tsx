import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
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
import { Component } from './ApprovalRoute';

const server = setupServer(
  http.get('*/api/v1/approvals/templates', () => HttpResponse.json({ items: [template()], count: 1 })),
  http.get('*/api/v1/approvals/templates/approvaltemplate:refund', () => HttpResponse.json({ template: template(), versions: [templateVersion()] })),
  http.get('*/api/v1/approvals/tasks', () => HttpResponse.json({ items: [task()], count: 1 })),
  http.get('*/api/v1/approvals/instances/approvalinstance:one', () => HttpResponse.json(instance())),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); });
afterAll(() => server.close());

describe('ApprovalRoute', () => {
  it('navigates from the template list to immutable version details and exposes authorized lifecycle actions', async () => {
    renderRoute(context(['approval.templates.list', 'approval.templates.get', 'approval.templates.create', 'approval.templates.revise', 'approval.templates.enable']));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '大额退款审批' }));

    expect(await screen.findByText('规则版本历史')).toBeTruthy();
    expect(screen.getByText('12 小时后提醒')).toBeTruthy();
    expect(screen.getByRole('button', { name: '修订' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '启用' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '停用' })).toBeNull();
  });

  it('loads task and instance evidence independently and exposes only the authorized decision', async () => {
    renderRoute(context(['approval.templates.list', 'approval.tasks.list', 'approval.instances.get', 'approval.tasks.approve']));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '我的待办' }));

    expect(await screen.findByText('财务负责人审批')).toBeTruthy();
    expect(screen.getByRole('button', { name: '批准' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '拒绝' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /审批实例/ }));

    expect(await screen.findByLabelText('审批实例证据')).toBeTruthy();
    expect(screen.getByText('审批步骤与待办')).toBeTruthy();
    expect(screen.getByText('审批决定记录')).toBeTruthy();
    expect(screen.getByText('证据完整，同意退款')).toBeTruthy();
    expect(screen.getByText('¥100.00')).toBeTruthy();
  });

  it('authoritatively rereads a version conflict and never repeats an already completed lifecycle action', async () => {
    let reads = 0;
    server.use(
      http.get('*/api/v1/approvals/templates', () => HttpResponse.json({ items: [{ ...template(), ...(reads++ === 0 ? {} : { state: 'enabled', activeVersion: 1, version: 5 }) }], count: 1 })),
      http.post('*/api/v1/approvals/templates/approvaltemplate:refund/enablement', () => HttpResponse.json({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT', requestId: 'request:approval-conflict', retryable: true }, { status: 409 })),
    );
    renderRoute(context(['approval.templates.list', 'approval.templates.enable']));
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '启用' }));
    await user.type(screen.getByLabelText('审计原因'), '规则已完成复核');
    await user.click(screen.getByRole('button', { name: '确认提交' }));

    const conflict = await screen.findByRole('alert', { name: '审批并发冲突' });
    expect(conflict.textContent).toContain('已进入终态');
    expect(screen.getByLabelText<HTMLTextAreaElement>('审计原因').value).toBe('规则已完成复核');
    expect(screen.getByRole('button', { name: '关闭并重新选择目标' })).toBeTruthy();
  });
});

function renderRoute(value: ConsoleContext) {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={['/scopes/mall/mall%3Aone/settings/approvals']}><QueryClientProvider client={query}><ConsoleContextProvider value={value}><StepupProvider controller={{ request: vi.fn() }}><DependencyProvider value={createConsoleDependencies()}><Component /></DependencyProvider></StepupProvider></ConsoleContextProvider></QueryClientProvider></MemoryRouter>);
}

function context(capabilities: readonly string[]): ConsoleContext {
  const scope = { kind: 'mall' as const, id: 'mall:one', name: '测试商城' };
  const permissions = ['approval.read', ...(capabilities.some((item) => item.startsWith('approval.templates.') && !item.endsWith('.list') && !item.endsWith('.get')) ? ['approval.template.manage'] : []), ...(capabilities.some((item) => item.startsWith('approval.tasks.') && item !== 'approval.tasks.list') ? ['approval.task.decide'] : [])];
  return { session: { actor: 'actor:one', membership: 'membership:owner', accessVersion: 7, permissions, capabilities: [...capabilities], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null }, csrf: 'csrf:approval', syncedAt: '2026-09-04T00:00:00.000Z' }, profile: { display_name: '审批管理员', employee_no: null }, scope, scopes: [scope] };
}

function template() {
  return { id: 'approvaltemplate:refund', scopeId: 'scope:mall', code: 'refund.high', name: '大额退款审批', subjectKind: 'refund', state: 'draft', activeVersion: null, version: 4, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' };
}

function templateVersion() {
  return { id: 'approvaltemplateversion:one', templateId: 'approvaltemplate:refund', number: 1, name: '大额退款审批', subjectKind: 'refund', steps: [{ sequence: 1, name: '财务负责人审批', approvers: [{ kind: 'permission', value: 'finance.approve', minimumApprovals: 1 }], dueHours: 24 }], escalations: [{ afterHours: 12, action: 'notify' }], createdBy: 'membership:owner', createdAt: '2026-09-01T00:00:00.000Z' };
}

function task() {
  return { id: 'approvaltask:one', instanceId: 'approvalinstance:one', sequence: 1, name: '财务负责人审批', assigneeKind: 'permission', assignee: 'finance.approve', state: 'pending', dueAt: '2026-09-05T00:00:00.000Z', decidedBy: null, decidedAt: null, reason: null, minimumApprovals: 1, approvalCount: 0, version: 2 };
}

function instance() {
  return { id: 'approvalinstance:one', scopeId: 'scope:mall', templateId: 'approvaltemplate:refund', templateVersion: 1, subjectKind: 'refund', subjectId: 'refund:one', subjectVersion: 2, subjectSnapshot: {}, action: 'refund.approve', evidenceHash: 'a'.repeat(64), amountMinor: 10000, currency: 'CNY', constraints: {}, requesterId: 'membership:maker', state: 'approved', currentStep: 1, stepCount: 1, version: 3, createdAt: '2026-09-04T00:00:00.000Z', decidedAt: '2026-09-04T01:00:00.000Z', expiresAt: null, tasks: [{ ...task(), state: 'approved', approvalCount: 1, version: 3, decidedBy: 'membership:owner', decidedAt: '2026-09-04T01:00:00.000Z', reason: '证据完整，同意退款' }], decisions: [{ id: 'approvaldecision:one', instanceId: 'approvalinstance:one', taskId: 'approvaltask:one', outcome: 'approved', reason: '证据完整，同意退款', actorId: 'membership:owner', evidence: {}, proofId: null, proof: null, decidedAt: '2026-09-04T01:00:00.000Z' }] };
}
