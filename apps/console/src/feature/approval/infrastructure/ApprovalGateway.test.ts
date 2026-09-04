// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApprovalCommand, ApprovalTask, ApprovalTemplate, ApprovalTemplateDraft } from '../model/Approval';
import { ApprovalGateway } from './ApprovalGateway';

const requests: Request[] = [];
const respondTemplate = ({ request }: { request: Request }) => { requests.push(request.clone()); return HttpResponse.json(templateResult()); };
const respondDecision = ({ request }: { request: Request }) => { requests.push(request.clone()); return HttpResponse.json(decisionResult()); };
const server = setupServer(
  http.post('https://shop.test/api/v1/approvals/templates', respondTemplate),
  http.post('https://shop.test/api/v1/approvals/templates/approvaltemplate:refund/versions', respondTemplate),
  http.post('https://shop.test/api/v1/approvals/templates/approvaltemplate:refund/enablement', respondTemplate),
  http.delete('https://shop.test/api/v1/approvals/templates/approvaltemplate:refund/enablement', respondTemplate),
  http.post('https://shop.test/api/v1/approvals/tasks/approvaltask:one/approval', respondDecision),
  http.post('https://shop.test/api/v1/approvals/tasks/approvaltask:one/rejection', respondDecision),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { requests.length = 0; });
afterAll(() => server.close());

describe('ApprovalGateway commands', () => {
  it('executes create, revise, enable and disable with stable identities and target versions', async () => {
    const gateway = new ApprovalGateway('https://shop.test');
    const template = templateModel();
    const draft = templateDraft();
    const commands: readonly ApprovalCommand[] = [
      { kind: 'create', draft },
      { kind: 'revise', template, draft },
      { kind: 'enable', template, reason: '规则复核完成' },
      { kind: 'disable', template, reason: '业务流程已下线' },
    ];
    for (const [index, command] of commands.entries()) await gateway.execute(context(), command, `identity:${index}`);

    expect(requests.map((request) => request.headers.get('idempotency-key'))).toEqual(['identity:0', 'identity:1', 'identity:2', 'identity:3']);
    expect(requests.map((request) => request.headers.get('if-match'))).toEqual([null, '"4"', '"4"', '"4"']);
    expect(await requests[0]!.json()).toMatchObject({ code: 'refund.high', subjectKind: 'refund', steps: [{ sequence: 1 }] });
    expect(await requests[1]!.json()).toMatchObject({ expectedVersion: 4, name: '大额退款审批' });
    expect(await requests[2]!.json()).toEqual({ expectedVersion: 4, reason: '规则复核完成' });
    expect(await requests[3]!.json()).toEqual({ expectedVersion: 4, reason: '业务流程已下线' });
  });

  it('executes approve and reject independently without exposing the returned one-time proof', async () => {
    const gateway = new ApprovalGateway('https://shop.test');
    const task = taskModel();
    const approved = await gateway.execute(context(), { kind: 'approve', task, reason: '证据完整，同意退款' }, 'identity:approve');
    const rejected = await gateway.execute(context(), { kind: 'reject', task, reason: '订单证据不完整' }, 'identity:reject');

    expect(requests.map((request) => request.headers.get('if-match'))).toEqual(['"2"', '"2"']);
    expect(await requests[0]!.json()).toEqual({ expectedVersion: 2, reason: '证据完整，同意退款' });
    expect(await requests[1]!.json()).toEqual({ expectedVersion: 2, reason: '订单证据不完整' });
    expect(approved).toMatchObject({ id: 'approvaltask:one', instanceId: 'approvalinstance:one', state: 'approved', version: 3 });
    expect(approved.proof).toBe('one-time-proof');
    expect(rejected.proof).toBe('one-time-proof');
  });
});

function templateDraft(): ApprovalTemplateDraft {
  return { code: 'refund.high', name: '大额退款审批', subjectKind: 'refund', steps: [{ sequence: 1, name: '财务负责人审批', approvers: [{ kind: 'permission', value: 'finance.approve', minimumApprovals: 1 }], dueHours: 24 }], escalations: [{ afterHours: 12, action: 'notify' }] };
}

function templateModel(): ApprovalTemplate {
  return { id: 'approvaltemplate:refund', code: 'refund.high', name: '大额退款审批', subjectKind: 'refund', state: 'draft', activeVersion: null, version: 4, updatedAt: '2026-09-04T00:00:00.000Z' };
}

function taskModel(): ApprovalTask {
  return { id: 'approvaltask:one', instanceId: 'approvalinstance:one', sequence: 1, name: '财务负责人审批', assigneeKind: 'permission', assignee: 'finance.approve', state: 'pending', dueAt: '2026-09-05T00:00:00.000Z', minimumApprovals: 1, approvalCount: 0, version: 2 };
}

function templateResult() {
  const template = { ...templateModel(), scopeId: 'scope:mall', createdAt: '2026-09-01T00:00:00.000Z' };
  return { template, active: { id: 'approvaltemplateversion:one', templateId: template.id, number: 1, name: template.name, subjectKind: template.subjectKind, steps: templateDraft().steps, escalations: templateDraft().escalations, createdBy: 'membership:owner', createdAt: '2026-09-04T00:00:00.000Z' } };
}

function decisionResult() {
  const task = { ...taskModel(), state: 'approved', approvalCount: 1, version: 3, decidedBy: 'membership:owner', decidedAt: '2026-09-04T01:00:00.000Z', reason: '同意' };
  const instance = { id: 'approvalinstance:one', scopeId: 'scope:mall', templateId: 'approvaltemplate:refund', templateVersion: 1, subjectKind: 'refund', subjectId: 'refund:one', subjectVersion: 2, subjectSnapshot: {}, action: 'refund.approve', evidenceHash: 'hash', amountMinor: 10000, currency: 'CNY', constraints: {}, requesterId: 'membership:maker', state: 'approved', currentStep: 1, stepCount: 1, version: 3, createdAt: '2026-09-04T00:00:00.000Z', decidedAt: '2026-09-04T01:00:00.000Z', expiresAt: null, tasks: [task], decisions: [] };
  return { task, instance, decision: { id: 'approvaldecision:one', instanceId: instance.id, taskId: task.id, outcome: 'approved', reason: '同意', actorId: 'membership:owner', evidence: {}, proofId: 'approvalproof:one', proof: 'one-time-proof', decidedAt: '2026-09-04T01:00:00.000Z' } };
}

function context(): ConsoleContext {
  const scope = { kind: 'mall' as const, id: 'mall:one', name: '测试商城' };
  return { session: { actor: 'actor:one', membership: 'membership:owner', accessVersion: 7, permissions: [], capabilities: [], target: 'console', scope, scopes: [scope], assurance: { level: 3 }, security: { hasLocalCredential: true, phoneMasked: '138****0000', passwordChangedAt: null }, csrf: 'csrf:approval', syncedAt: '2026-09-04T00:00:00.000Z' }, profile: { display_name: '审批管理员', employee_no: null }, scope, scopes: [scope] };
}
