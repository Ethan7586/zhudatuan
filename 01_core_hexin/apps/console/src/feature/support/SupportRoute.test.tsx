import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleContextProvider } from '../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { SupportCase, SupportMessage } from './SupportSchema';
import { Component } from './SupportRoute';

const mocks = vi.hoisted(() => ({
  canCreateSupportCase: vi.fn(),
  canReviewSupportCase: vi.fn(),
  canSendSupportMessage: vi.fn(),
  canUploadSupportAttachment: vi.fn(),
  createSupportCase: vi.fn(),
  readCases: vi.fn(),
  readHistory: vi.fn(),
  readMessages: vi.fn(),
  reviewSupportPriority: vi.fn(),
  sendSupportMessage: vi.fn(),
  uploadSupportAttachment: vi.fn(),
}));

vi.mock('./SupportQuery', () => ({
  readCases: mocks.readCases,
  readHistory: mocks.readHistory,
  readMessages: mocks.readMessages,
  supportCaseKey: (_context: unknown, view: string, cursor?: string) => ['support-cases', view, cursor ?? null],
  supportMessageKey: (_context: unknown, caseId: string, cursor?: string) => ['support-messages', caseId, cursor ?? null],
  supportHistoryKey: (_context: unknown, caseId: string) => ['support-history', caseId],
}));

vi.mock('./SupportCommand', () => ({
  canCreateSupportCase: mocks.canCreateSupportCase,
  canReviewSupportCase: mocks.canReviewSupportCase,
  canSendSupportMessage: mocks.canSendSupportMessage,
  canUploadSupportAttachment: mocks.canUploadSupportAttachment,
  createSupportCase: mocks.createSupportCase,
  reviewSupportPriority: mocks.reviewSupportPriority,
  sendSupportMessage: mocks.sendSupportMessage,
  uploadSupportAttachment: mocks.uploadSupportAttachment,
}));

const supportCase = {
  id: 'case:benefit-1001',
  conversation_id: 'conversation:benefit-1001',
  priority: 'high',
  skill: '福利售后',
  state: 'open',
  assigned_agent_id: 'agent:wing-07',
  response_due_at: '2026-08-30T10:30:00.000Z',
  resolution_due_at: '2026-08-30T16:00:00.000Z',
  created_at: '2026-08-30T08:00:00.000Z',
  updated_at: '2026-08-30T09:15:00.000Z',
  version: 12,
  subject: '中秋礼盒兑换码无法使用',
  order_id: 'order:SW-20260830-1001',
  channel: 'wechat',
} satisfies SupportCase;

const messages = [
  {
    id: 'message:customer-1',
    authorType: 'member',
    author: 'member:10086',
    body: '兑换时提示兑换码无效，请帮我查一下。',
    createdAt: '2026-08-30T09:10:00.000Z',
    visibility: 'public',
  },
  {
    id: 'message:agent-1',
    authorType: 'agent',
    author: 'agent:wing-07',
    body: '已经收到，我正在核对该订单。',
    createdAt: '2026-08-30T09:12:00.000Z',
    visibility: 'public',
  },
] as const satisfies readonly SupportMessage[];

const context: ConsoleContext = {
  session: {
    actor: 'actor:support-test',
    membership: 'membership:support-test',
    accessVersion: 8,
    permissions: ['support.cases.read', 'support.messages.read', 'support.message.send', 'support.case.create', 'support.case.manage', 'support.history.read'],
    capabilities: ['support.cases.read', 'support.messages.read', 'support.messages.send', 'support.cases.create', 'support.cases.update',
      'support.attachments.create', 'support.history.read'],
    csrf: 'csrf-support-console-test',
    target: 'console',
    scope: { kind: 'enterprise', id: 'enterprise:1', name: '福福网' },
    scopes: [{ kind: 'enterprise', id: 'enterprise:1', name: '福福网' }],
    governance: { level: 'administrator', exactOwner: false, organization: 'enterprise:1' },
    assurance: { level: 2, verified: '2026-08-30T08:00:00.000Z' },
    syncedAt: '2026-08-30T08:00:00.000Z',
  },
  profile: { display_name: '客服测试坐席', employee_no: 'SW-007' },
  scope: { kind: 'enterprise', id: 'enterprise:1', name: '福福网' },
  scopes: [{ kind: 'enterprise', id: 'enterprise:1', name: '福福网' }],
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});

beforeEach(() => {
  mocks.readCases.mockResolvedValue({ items: [supportCase], count: 1, views: { handling: 1, review: 1, created: 2, all: 3 } });
  mocks.readMessages.mockResolvedValue({ items: messages, attachments: [], count: messages.length });
  mocks.readHistory.mockResolvedValue({ items: [], count: 0 });
  mocks.canCreateSupportCase.mockReturnValue(true);
  mocks.canReviewSupportCase.mockReturnValue(true);
  mocks.canSendSupportMessage.mockReturnValue(true);
  mocks.canUploadSupportAttachment.mockReturnValue(true);
  mocks.createSupportCase.mockResolvedValue({ ...supportCase, id: 'case:new-service' });
  mocks.reviewSupportPriority.mockResolvedValue({ ...supportCase, priority: 'urgent', version: 13 });
  mocks.sendSupportMessage.mockResolvedValue({ id: 'message:sent-1' });
  mocks.uploadSupportAttachment.mockResolvedValue({ id: 'evidence:one', state: 'pending' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Support Chat VI route', () => {
  it('restores a deep-linked case with its real messages and right-side context', async () => {
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);

    expect(await screen.findByText(messages[0].body)).toBeTruthy();
    expect(screen.getByText(messages[1].body)).toBeTruthy();
    expect(screen.getAllByText(supportCase.subject).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: new RegExp(supportCase.subject) }).getAttribute('aria-current')).toBe('page');

    const caseContext = screen.getByRole('complementary', { name: '工单上下文' });
    expect(within(caseContext).getByText('微信')).toBeTruthy();
    expect(within(caseContext).getByText('福福网')).toBeTruthy();
    expect(within(caseContext).getByText('福利售后')).toBeTruthy();
    expect(within(caseContext).getByText('order:SW-20260830-1001')).toBeTruthy();
    expect(within(caseContext).queryByText('agent:wing-07')).toBeNull();
    expect(within(caseContext).queryByText('member:10086')).toBeNull();
    expect(mocks.readMessages).toHaveBeenCalledWith(context, supportCase.id, undefined, expect.any(AbortSignal));
  });

  it('sends a reply through the support command when the session is authorized', async () => {
    const user = userEvent.setup();
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);

    await user.type(screen.getByRole('textbox', { name: '回复内容' }), '  已为您重新激活兑换码。  ');
    await user.click(screen.getByRole('button', { name: '发送回复' }));

    await waitFor(() => expect(mocks.sendSupportMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendSupportMessage).toHaveBeenCalledWith(context, {
      caseId: supportCase.id,
      caseVersion: supportCase.version,
      caseState: supportCase.state,
      message: '  已为您重新激活兑换码。  ',
      visibility: 'public',
    });
  });

  it('sends an internal note without presenting it as a requester reply', async () => {
    const user = userEvent.setup();
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);

    await user.click(screen.getByRole('tab', { name: '内部备注' }));
    await user.type(screen.getByRole('textbox', { name: '内部备注内容' }), '请财务核对退款流水');
    await user.click(screen.getByRole('button', { name: '添加备注' }));

    await waitFor(() => expect(mocks.sendSupportMessage).toHaveBeenCalledTimes(1));
    expect(mocks.sendSupportMessage).toHaveBeenCalledWith(context, expect.objectContaining({
      caseId: supportCase.id, message: '请财务核对退款流水', visibility: 'internal',
    }));
  });

  it('keeps a failed draft and allows a deliberate retry without duplicate submissions', async () => {
    const user = userEvent.setup();
    mocks.sendSupportMessage.mockRejectedValueOnce(new Error('NETWORK_FAILURE')).mockResolvedValueOnce({ id: 'message:retry' });
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);
    const composer = screen.getByRole('textbox', { name: '回复内容' });
    await user.type(composer, '保留这条回复');
    await user.click(screen.getByRole('button', { name: '发送回复' }));

    expect(await screen.findByText(/发送失败，请刷新工单后重试/)).toBeTruthy();
    expect((composer as HTMLTextAreaElement).value).toBe('保留这条回复');
    expect(mocks.sendSupportMessage).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '发送回复' }));
    await waitFor(() => expect(mocks.sendSupportMessage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((composer as HTMLTextAreaElement).value).toBe(''));
  });

  it('loads older history above the latest page while retaining both pages', async () => {
    const user = userEvent.setup();
    const older = { ...messages[0], id: 'message:older', body: '这是更早的历史消息', createdAt: '2026-08-29T09:00:00.000Z' };
    mocks.readMessages.mockImplementation((_context, _caseId, cursor) => Promise.resolve(cursor === undefined
      ? { items: messages, count: messages.length, nextCursor: 'cursor:older' }
      : { items: [older], count: 1 }));
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);
    await user.click(screen.getByRole('button', { name: '加载更早消息' }));

    expect(await screen.findByText(older.body)).toBeTruthy();
    expect(screen.getByText(messages[0].body)).toBeTruthy();
    expect(mocks.readMessages).toHaveBeenLastCalledWith(context, supportCase.id, 'cursor:older', expect.any(AbortSignal));
  });

  it('shows the welcome state before a case is selected and does not read messages', async () => {
    renderRoute('/scopes/enterprise/enterprise%3A1/support');

    expect(await screen.findByRole('heading', { name: '选择一条工单开始处理' })).toBeTruthy();
    expect(screen.getByText('从左侧队列打开工单，查看完整沟通记录与处理信息。')).toBeTruthy();
    expect(screen.getByText('尚未选择工单')).toBeTruthy();
    expect(mocks.readMessages).not.toHaveBeenCalled();
  });

  it('switches between handling, review and created queues through the address-backed view', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/enterprise/enterprise%3A1/support');
    await screen.findByRole('heading', { name: '选择一条工单开始处理' });

    expect((await screen.findByRole('button', { name: /待我处理 1/ })).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: /待我审批 1/ }));
    await waitFor(() => expect(mocks.readCases).toHaveBeenCalledWith(context, 'review', undefined, expect.any(AbortSignal)));
    expect(screen.getByRole('button', { name: /待我审批 1/ }).getAttribute('aria-current')).toBe('page');
    await user.click(screen.getByRole('button', { name: /我发起的 2/ }));

    await waitFor(() => expect(mocks.readCases).toHaveBeenCalledWith(context, 'created', undefined, expect.any(AbortSignal)));
    expect(screen.getByRole('button', { name: /我发起的 2/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: new RegExp(supportCase.subject) }).getAttribute('href')).toContain('?view=created');
  });

  it('lets an authorized reviewer assign a P grade and records the exact version', async () => {
    const user = userEvent.setup();
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);

    await user.selectOptions(screen.getByRole('combobox', { name: '影响等级' }), 'P0');
    await user.click(screen.getByRole('button', { name: '确认定为 P0' }));

    await waitFor(() => expect(mocks.reviewSupportPriority).toHaveBeenCalledWith(context, supportCase.id, supportCase.version, 'P0'));
  });

  it('opens a quiet in-workbench composer and creates a real case without leaving the service center', async () => {
    const user = userEvent.setup();
    renderRoute('/scopes/enterprise/enterprise%3A1/support');
    await screen.findByRole('heading', { name: '选择一条工单开始处理' });

    await user.click(screen.getByRole('button', { name: '新建工单' }));
    expect(screen.getByRole('heading', { name: '新建工单' })).toBeTruthy();
    await user.type(screen.getByRole('textbox', { name: '工单标题' }), '退款进度需要核实');
    await user.type(screen.getByRole('textbox', { name: '第一条留言' }), '订单退款状态长时间没有更新。');
    await user.click(screen.getByRole('button', { name: '创建并进入会话' }));

    await waitFor(() => expect(mocks.createSupportCase).toHaveBeenCalledWith(context, {
      subject: '退款进度需要核实', message: '订单退款状态长时间没有更新。',
    }));
    await waitFor(() => expect(mocks.readMessages).toHaveBeenCalledWith(context, 'case:new-service', undefined, expect.any(AbortSignal)));
  });

  it('keeps a failed case draft and exposes the server request id', async () => {
    const user = userEvent.setup();
    mocks.createSupportCase.mockRejectedValue(Object.assign(new Error('internal'), {
      name: 'ApiError', code: 'INTERNAL_ERROR', requestId: 'request-create-case-1', status: 500,
    }));
    renderRoute('/scopes/enterprise/enterprise%3A1/support');
    await screen.findByRole('heading', { name: '选择一条工单开始处理' });

    await user.click(screen.getByRole('button', { name: '新建工单' }));
    const subject = screen.getByRole('textbox', { name: '工单标题' });
    const message = screen.getByRole('textbox', { name: '第一条留言' });
    await user.type(subject, '退款进度需要核实');
    await user.type(message, '订单退款状态长时间没有更新。');
    await user.click(screen.getByRole('button', { name: '创建并进入会话' }));

    expect(await screen.findByText(/INTERNAL_ERROR · 请求 request-create-case-1/)).toBeTruthy();
    expect((subject as HTMLInputElement).value).toBe('退款进度需要核实');
    expect((message as HTMLTextAreaElement).value).toBe('订单退款状态长时间没有更新。');
  });

  it('places the workspace refresh below the identity status and disables create honestly when unavailable', async () => {
    mocks.canCreateSupportCase.mockReturnValue(false);
    renderRoute('/scopes/enterprise/enterprise%3A1/support');
    await screen.findByRole('heading', { name: '选择一条工单开始处理' });

    const status = screen.getByLabelText('当前受理状态');
    expect(within(status).getByRole('button', { name: '刷新服务中心' })).toBeTruthy();
    const create = screen.getByRole('button', { name: '新建工单' });
    expect(create.hasAttribute('disabled')).toBe(true);
    expect(create.getAttribute('title')).toBe('当前身份没有新建工单权限');
  });

  it('shows a compact recoverable queue error without exposing a large technical alert', async () => {
    const user = userEvent.setup();
    mocks.readCases.mockRejectedValue(Object.assign(new Error('not found'), {
      name: 'ApiError', code: 'NOT_FOUND', requestId: 'request-support-1', status: 404,
    }));
    renderRoute('/scopes/enterprise/enterprise%3A1/support');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('工单服务暂未接通')).toBeTruthy();
    expect(within(alert).getByText('请求 request-support-1')).toBeTruthy();
    await user.click(within(alert).getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(mocks.readCases.mock.calls.length).toBeGreaterThan(1));
  });

  it('uses the service-center copy and enables the review queue while keeping future operations inert', async () => {
    renderRoute(`/scopes/enterprise/enterprise%3A1/support/${encodeURIComponent(supportCase.id)}`);
    await screen.findByText(messages[0].body);

    expect(screen.getByRole('heading', { name: '服务中心' })).toBeTruthy();
    expect(screen.getByText('消费者与管理员共用一个工作台')).toBeTruthy();
    expect(screen.getAllByText('管理员').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /待我审批/ }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('tab', { name: '内部备注' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('tab', { name: '协同供应商' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '转交' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '升级至平台支持' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '完成工单' }).hasAttribute('disabled')).toBe(true);
    expect(document.body.textContent).not.toMatch(/SMART WING|ZHUDATUAN SUPPORT|客服坐席|客户/);
  });
});

function renderRoute(entry: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={client}>
        <ConsoleContextProvider value={context}>
          <Routes>
            <Route path="/scopes/:scopeKind/:scopeId/support" element={<Component />} />
            <Route path="/scopes/:scopeKind/:scopeId/support/:caseId" element={<Component />} />
          </Routes>
        </ConsoleContextProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}
