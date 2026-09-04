import { describe, expect, it } from 'vitest';
import type { ApprovalEditor } from '../model/Approval';
import { validateApprovalEditor } from './ApprovalViewModel';

describe('ApprovalViewModel validation', () => {
  it('requires step-up before a template can be created', () => {
    const editor: ApprovalEditor = { command: 'create', draft: { code: 'refund.high', name: '大额退款', subjectKind: 'refund', steps: [{ sequence: 1, name: '财务负责人审批', approvers: [{ kind: 'permission', value: 'finance.approve', minimumApprovals: 1 }], dueHours: 24 }], escalations: [] } };
    expect(validateApprovalEditor(editor, 2)).toBe('此操作需要先完成二次验证。');
    expect(validateApprovalEditor(editor, 3)).toBeUndefined();
  });

  it('rejects an empty audit reason for a decision', () => {
    const editor: ApprovalEditor = { command: 'approve', reason: '', task: { id: 'approvaltask:1', instanceId: 'approvalinstance:1', sequence: 1, name: '财务审批', assigneeKind: 'permission', assignee: 'finance.approve', state: 'pending', dueAt: null, minimumApprovals: 1, approvalCount: 0, version: 1 } };
    expect(validateApprovalEditor(editor, 3)).toContain('审计原因');
  });
});
