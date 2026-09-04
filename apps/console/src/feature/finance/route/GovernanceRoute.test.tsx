import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConsoleDependencies } from '../../../app/Dependencies';
import { DependencyProvider } from '../../../app/DependencyContext';
import { ConsoleContextProvider } from '../../../entity/session/ConsoleContext';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { StepupProvider } from '../../../entity/session/StepupContext';
import { Component as GovernanceRoute } from './GovernanceRoute';

const proof = 'p'.repeat(43);
const approvalProof = 'z'.repeat(43);
const commands: Readonly<{ operation: string; body: unknown; headers: Headers }>[] = [];
let approved = false;
const server = setupServer(
  http.get('*/api/v1/finance/policies', () => HttpResponse.json({ items: [policy()], count: 1 })),
  http.post('*/api/v1/finance/policies/previews', async ({ request }) => {
    const body = await request.json() as PolicyPreviewBody;
    commands.push({ operation: 'policypreview', body, headers: request.headers });
    return HttpResponse.json({ policy: { id: body.policyId, name: body.name, status: body.targetStatus, trigger: body.trigger, entries: body.entries, effectiveAt: body.effectiveAt, expiresAt: body.expiresAt, version: body.expectedVersion }, balanced: true, affectedCount: 17, sampleEntries: body.entries, previewToken: 'signed-policy-preview', previewHash: 'c'.repeat(64), expiresAt: '2099-09-07T10:00:00.000Z' });
  }),
  http.put('*/api/v1/finance/policies/:id', async ({ request, params }) => {
    commands.push({ operation: 'policymanage', body: await request.json(), headers: request.headers });
    return HttpResponse.json({ id: params.id, scope_id: 'enterprise:1', kind: 'accounting', rule: {}, state: 'active', version: 1 });
  }),
  http.get('*/api/v1/finance/reconciliationrepairs', () => HttpResponse.json({ items: [repair()], count: 1 })),
  http.post('*/api/v1/finance/reconciliationrepairs/previews', async ({ request }) => {
    const body = await request.json() as RepairPreviewBody;
    commands.push({ operation: 'repairpreview', body, headers: request.headers });
    return HttpResponse.json({ repair: repair({ status: 'draft', statementId: body.statementId, sourceJournalId: body.sourceJournalId, sourceHash: body.sourceHash, entries: body.entries, reason: body.reason, approvalInstanceId: null }), balanced: true, previewToken: 'signed-repair-preview', previewHash: 'd'.repeat(64), expiresAt: '2099-09-07T10:00:00.000Z' });
  }),
  http.post('*/api/v1/finance/reconciliationrepairs', async ({ request }) => {
    commands.push({ operation: 'repairsubmit', body: await request.json(), headers: request.headers });
    return HttpResponse.json(repair(), { status: 201 });
  }),
  http.get('*/api/v1/approvals/instances/:id', () => HttpResponse.json(instance(approved))),
  http.post('*/api/v1/approvals/tasks/:id/approval', async ({ request }) => {
    commands.push({ operation: 'approval', body: await request.json(), headers: request.headers });
    approved = true;
    return HttpResponse.json({ task: approvalTask('approved'), instance: instance(true), decision: decision() });
  }),
  http.post('*/api/v1/finance/reconciliationrepairs/:id/decisions', async ({ request }) => {
    commands.push({ operation: 'repairdecide', body: await request.json(), headers: request.headers });
    return HttpResponse.json(repair({ status: 'approved', checkerId: 'membership:checker', sourceReversalJournalId: 'journal:reversal', replacementJournalId: 'journal:replacement', version: 2 }));
  }),
  http.post('*/api/v1/finance/reconciliationrepairs/:id/reversals', async ({ request }) => {
    commands.push({ operation: 'repairreverse', body: await request.json(), headers: request.headers });
    return HttpResponse.json(repair({ status: 'reversed', rollbackJournalId: 'journal:rollback', version: 3 }));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { cleanup(); server.resetHandlers(); commands.length = 0; approved = false; });
afterAll(() => server.close());

describe('finance governance route', () => {
  it('previews and applies a balanced policy once, then rereads authoritative policies', async () => {
    const user = userEvent.setup();
    renderRoute();
    expect(await screen.findByRole('table', { name: '财务政策' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '新建政策' }));
    const dialog = await screen.findByRole('dialog', { name: '新建财务政策' });
    await user.type(within(dialog).getByLabelText('政策名称'), '订单收入确认');
    await user.type(within(dialog).getByLabelText('业务触发条件'), '订单支付成功');
    await user.click(within(dialog).getByRole('button', { name: '生成影响预览' }));
    expect(await within(dialog).findByText('17 条样本将命中')).toBeTruthy();
    expect(commands[0]?.body).toMatchObject({ targetStatus: 'active', name: '订单收入确认', trigger: '订单支付成功', expectedVersion: 1 });
    expect(commands[0]?.headers.get('if-match')).toBe('"1"');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), proof);
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对政策/ }));
    await user.dblClick(within(dialog).getByRole('button', { name: '确认生效' }));
    expect(await screen.findByRole('heading', { name: '操作已完成' })).toBeTruthy();
    const manage = commands.filter((item) => item.operation === 'policymanage');
    expect(manage).toHaveLength(1);
    expect(manage[0]?.body).toMatchObject({ kind: 'accounting', rule: { previewToken: 'signed-policy-preview', previewHash: 'c'.repeat(64), affectedCount: 17, targetStatus: 'active' } });
    expect(manage[0]?.headers.get('x-action-proof')).toBe(proof);
    expect(manage[0]?.headers.get('idempotency-key')).toBeTruthy();
  });

  it('submits a repair proposal without writing journals and exposes the bound approval instance', async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole('table', { name: '财务政策' });
    await user.click(screen.getByRole('button', { name: '对账修复' }));
    await screen.findByRole('table', { name: '对账修复' });
    await user.click(screen.getByRole('button', { name: '创建修复建议' }));
    const dialog = await screen.findByRole('dialog', { name: '创建对账修复建议' });
    await user.type(within(dialog).getByLabelText('账单业务编号'), 'statement:one');
    await user.type(within(dialog).getByLabelText('来源凭证编号'), 'journal:source');
    await user.type(within(dialog).getByLabelText('账单 SHA-256 校验值'), 'a'.repeat(64));
    await user.type(within(dialog).getByLabelText('修复原因'), '替换错误入账');
    await user.click(within(dialog).getByRole('button', { name: '生成修复预览' }));
    expect(await within(dialog).findByText('1 项差异')).toBeTruthy();
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), proof);
    await user.click(within(dialog).getByRole('checkbox', { name: /我已核对来源账单/ }));
    await user.dblClick(within(dialog).getByRole('button', { name: '提交复核' }));
    expect(await within(dialog).findByText(/审批实例/)).toBeTruthy();
    expect(commands.filter((item) => item.operation === 'repairsubmit')).toHaveLength(1);
    expect(commands.map((item) => item.operation)).toEqual(['repairpreview', 'repairsubmit']);
    expect(commands[1]?.body).toEqual({ previewToken: 'signed-repair-preview', previewHash: 'd'.repeat(64), expectedVersion: 1 });
    expect(commands[1]?.headers.get('x-action-proof')).toBe(proof);
    expect(within(dialog).getByText('待处理')).toBeTruthy();
  });

  it('passes an opaque one-use Approval proof to Finance and never renders it', async () => {
    const user = userEvent.setup();
    renderRoute('/finance/governance?area=repairs');
    await user.click(await screen.findByRole('button', { name: '复核详情' }));
    const dialog = await screen.findByRole('dialog', { name: '修复与审批详情' });
    await within(dialog).findByText('财务复核');
    await user.type(within(dialog).getByLabelText('复核意见'), '账单与来源凭证核验一致');
    await user.dblClick(within(dialog).getByRole('button', { name: '批准并追加修复分录' }));
    expect(await screen.findByText(/复核已通过，Finance 已追加冲正与替换分录/)).toBeTruthy();
    expect(commands.filter((item) => item.operation === 'approval')).toHaveLength(1);
    const decide = commands.find((item) => item.operation === 'repairdecide');
    expect(decide?.body).toEqual({ decision: 'approve', expectedVersion: 1, reason: '账单与来源凭证核验一致', approvalProof });
    expect(decide?.headers.get('x-action-proof')).toBeNull();
    expect(document.body.textContent).not.toContain(approvalProof);
  });

  it('rejects through Approval before Finance records the decision without a journal write', async () => {
    server.use(
      http.post('*/api/v1/approvals/tasks/:id/rejection', async ({ request }) => {
        commands.push({ operation: 'approvalreject', body: await request.json(), headers: request.headers });
        return HttpResponse.json({ task: { ...approvalTask('approved'), state: 'rejected', reason: '修复证据不足' }, instance: { ...instance(false), state: 'rejected', version: 2, decisions: [{ ...decision(), outcome: 'rejected', reason: '修复证据不足', proofId: null, proof: null }] }, decision: { ...decision(), outcome: 'rejected', reason: '修复证据不足', proofId: null, proof: null } });
      }),
      http.post('*/api/v1/finance/reconciliationrepairs/:id/decisions', async ({ request }) => {
        commands.push({ operation: 'repairreject', body: await request.json(), headers: request.headers });
        return HttpResponse.json(repair({ status: 'rejected', checkerId: 'membership:checker', decisionReason: '修复证据不足', version: 2 }));
      })
    );
    const user = userEvent.setup();
    renderRoute('/finance/governance?area=repairs');
    await user.click(await screen.findByRole('button', { name: '复核详情' }));
    const dialog = await screen.findByRole('dialog', { name: '修复与审批详情' });
    await user.type(await within(dialog).findByLabelText('复核意见'), '修复证据不足');
    await user.click(within(dialog).getByRole('button', { name: '驳回修复' }));
    expect(await screen.findByText(/复核已驳回，账本未发生变更/)).toBeTruthy();
    expect(commands.map(({ operation }) => operation)).toEqual(['approvalreject', 'repairreject']);
    expect(commands[1]?.body).toEqual({ decision: 'reject', expectedVersion: 1, reason: '修复证据不足' });
    expect(commands[1]?.headers.get('x-action-proof')).toBeNull();
  });

  it('reverses an approved repair by appending a version-bound rollback journal', async () => {
    server.use(http.get('*/api/v1/finance/reconciliationrepairs', () => HttpResponse.json({ items: [repair({ status: 'approved', checkerId: 'membership:checker', sourceReversalJournalId: 'journal:reversal', replacementJournalId: 'journal:replacement', version: 2 })], count: 1 })));
    const user = userEvent.setup();
    renderRoute('/finance/governance?area=repairs');
    await user.click(await screen.findByRole('button', { name: '追加回滚' }));
    const dialog = await screen.findByRole('dialog', { name: '回滚已批准修复' });
    await user.type(within(dialog).getByLabelText('回滚原因'), '发现来源渠道重复回单');
    await user.type(within(dialog).getByLabelText('一次性操作凭证'), proof);
    await user.click(within(dialog).getByRole('checkbox', { name: /我确认以追加回滚凭证/ }));
    await user.dblClick(within(dialog).getByRole('button', { name: '确认追加回滚凭证' }));
    expect(await screen.findByText(/修复已追加回滚凭证/)).toBeTruthy();
    const reverse = commands.filter(({ operation }) => operation === 'repairreverse');
    expect(reverse).toHaveLength(1);
    expect(reverse[0]?.body).toEqual({ expectedVersion: 2, reason: '发现来源渠道重复回单' });
    expect(reverse[0]?.headers.get('if-match')).toBe('"2"');
    expect(reverse[0]?.headers.get('x-action-proof')).toBe(proof);
  });

  it('hides mutation affordances and makes no mutation request without exact operation access', async () => {
    renderRoute('/finance/governance?area=repairs', readContext);
    expect(await screen.findByRole('table', { name: '对账修复' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '创建修复建议' })).toBeNull();
    expect(screen.queryByRole('button', { name: '追加回滚' })).toBeNull();
    expect(commands).toHaveLength(0);
  });
});

function renderRoute(entry = '/finance/governance', routeContext = context) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter initialEntries={[entry]}><DependencyProvider value={createConsoleDependencies()}><QueryClientProvider client={client}><ConsoleContextProvider value={routeContext}><StepupProvider controller={{ request: () => undefined }}><GovernanceRoute /></StepupProvider></ConsoleContextProvider></QueryClientProvider></DependencyProvider></MemoryRouter>);
}

const context: ConsoleContext = {
  session: { actor: 'actor:checker', membership: 'membership:checker', accessVersion: 7, csrf: 'csrf:finance', target: 'console', scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null }, syncedAt: '2026-09-07T08:00:00.000Z', permissions: ['finance.policy.read', 'finance.policy.preview', 'finance.policy.manage', 'finance.repair.read', 'finance.repair.preview', 'finance.repair.submit', 'finance.repair.decide', 'finance.repair.reverse', 'approval.read', 'approval.task.decide'], capabilities: ['finance.policies.read', 'finance.policies.preview', 'finance.policies.manage', 'finance.reconciliationrepairs.read', 'finance.reconciliationrepairs.preview', 'finance.reconciliationrepairs.submit', 'finance.reconciliationrepairs.decide', 'finance.reconciliationrepairs.reverse', 'approval.instances.get', 'approval.tasks.approve', 'approval.tasks.reject'] },
  profile: { display_name: '财务复核', employee_no: null }, scope: { kind: 'enterprise', id: 'enterprise:1' }, scopes: [{ kind: 'enterprise', id: 'enterprise:1' }],
};
const readContext: ConsoleContext = { ...context, session: { ...context.session, permissions: ['finance.policy.read', 'finance.repair.read'], capabilities: ['finance.policies.read', 'finance.reconciliationrepairs.read'] } };

function entry() { return { account: 'expense.goods', debitMinor: 100, creditMinor: 0, currency: 'CNY', memo: '修复借方' }; }
function policy() { return { id: 'financepolicy:orders', name: '订单收入政策', status: 'active', trigger: '订单支付成功', entries: [entry(), { ...entry(), account: 'liability.payable', debitMinor: 0, creditMinor: 100, memo: '修复贷方' }], effectiveAt: '2026-09-01T00:00:00.000Z', expiresAt: null, version: 1 }; }
function repair(change: Readonly<Record<string, unknown>> = {}) { return { id: 'reconciliationrepair:one', statementId: 'statement:one', status: 'submitted', sourceHash: 'a'.repeat(64), sourceJournalId: 'journal:source', sourceJournalHash: 'b'.repeat(64), previewHash: 'd'.repeat(64), differences: [{ id: 'reconciliationdifference:one', kind: 'statementbalance', expectedMinor: 900, actualMinor: 1_000, deltaMinor: 100, currency: 'CNY' }], entries: [entry(), { ...entry(), account: 'liability.payable', debitMinor: 0, creditMinor: 100, memo: '修复贷方' }], makerId: 'membership:maker', checkerId: null, approvalInstanceId: 'approvalinstance:one', approvalAmountMinor: 1_000, sourceReversalJournalId: null, replacementJournalId: null, rollbackJournalId: null, reason: '替换错误入账', decisionReason: null, reverseReason: null, reversedBy: null, decidedAt: null, reversedAt: null, version: 1, createdAt: '2026-09-07T08:00:00.000Z', updatedAt: '2026-09-07T08:00:00.000Z', ...change }; }
function approvalTask(state: 'pending' | 'approved') { return { id: 'approvaltask:one', instanceId: 'approvalinstance:one', sequence: 1, name: '财务复核', assigneeKind: 'permission', assignee: 'finance.repair.decide', state, dueAt: null, decidedBy: state === 'approved' ? 'membership:checker' : null, decidedAt: state === 'approved' ? '2026-09-07T09:00:00.000Z' : null, reason: state === 'approved' ? '账单与来源凭证核验一致' : null, minimumApprovals: 1, approvalCount: state === 'approved' ? 1 : 0, version: state === 'approved' ? 2 : 1 }; }
function decision() { return { id: 'approvaldecision:one', instanceId: 'approvalinstance:one', taskId: 'approvaltask:one', outcome: 'approved', reason: '账单与来源凭证核验一致', actorId: 'membership:checker', evidence: {}, proofId: 'approvalproof:one', proof: approvalProof, decidedAt: '2026-09-07T09:00:00.000Z' }; }
function instance(done: boolean) { return { id: 'approvalinstance:one', scopeId: 'enterprise:1', templateId: 'approvaltemplate:finance', templateVersion: 1, subjectKind: 'financerepair', subjectId: 'reconciliationrepair:one', subjectVersion: 1, subjectSnapshot: {}, action: 'finance.repair.apply', evidenceHash: 'd'.repeat(64), amountMinor: 1_000, currency: 'CNY', constraints: {}, requesterId: 'membership:maker', state: done ? 'approved' : 'pending', currentStep: 1, stepCount: 1, version: done ? 2 : 1, createdAt: '2026-09-07T08:00:00.000Z', decidedAt: done ? '2026-09-07T09:00:00.000Z' : null, expiresAt: null, tasks: [approvalTask(done ? 'approved' : 'pending')], decisions: done ? [decision()] : [] }; }

interface PolicyPreviewBody { readonly policyId: string; readonly targetStatus: 'active' | 'retired'; readonly name: string; readonly trigger: string; readonly entries: readonly ReturnType<typeof entry>[]; readonly effectiveAt: string; readonly expiresAt: string | null; readonly expectedVersion: number }
interface RepairPreviewBody { readonly statementId: string; readonly sourceJournalId: string; readonly sourceHash: string; readonly entries: readonly ReturnType<typeof entry>[]; readonly reason: string }
