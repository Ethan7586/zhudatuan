import { describe, expect, it } from 'vitest';
import { ApprovalInstance } from '../domain/model/ApprovalInstance';
import { ApprovalTask } from '../domain/model/ApprovalTask';
import { ApprovalTemplate } from '../domain/model/ApprovalTemplate';
import { ApproverPolicy } from '../domain/policy/ApproverPolicy';
import { EscalationPolicy } from '../domain/policy/EscalationPolicy';
import { ApprovalDecision } from '../domain/value/ApprovalDecision';
import { ApprovalSubject } from '../domain/value/ApprovalSubject';

describe('Approval domain', () => {
  it('freezes a valid sequential template and rejects gaps or duplicate assignments', () => {
    const template = new ApprovalTemplate({
      code: 'voucher.issue',
      name: '卡券发放审批',
      subjectKind: 'voucherissue',
      steps: [
        { sequence: 1, name: '运营复核', dueHours: 4, approvers: [{ kind: 'permission', value: 'approval.task.decide', minimumApprovals: 2 }] },
        { sequence: 2, name: '财务确认', dueHours: 8, approvers: [{ kind: 'role', value: 'role:finance', minimumApprovals: 1 }] },
      ],
    });
    expect(Object.isFrozen(template)).toBe(true);
    expect(Object.isFrozen(template.steps)).toBe(true);
    expect(() => new ApprovalTemplate({ ...template, steps: [{ ...template.steps[0]!, sequence: 2 }] })).toThrowError(/VALIDATION_FAILED/);
    expect(
      () =>
        new ApprovalTemplate({
          ...template,
          steps: [{ ...template.steps[0]!, approvers: [template.steps[0]!.approvers[0]!, template.steps[0]!.approvers[0]!] }],
        })
    ).toThrowError(/VALIDATION_FAILED/);
  });

  it('binds a subject snapshot and a normalized immutable decision', () => {
    const subject = new ApprovalSubject({ kind: 'financerepair', id: 'financerepair:one', version: 7, snapshot: { debitMinor: 100, creditMinor: 100 } });
    const decision = new ApprovalDecision({ outcome: 'approved', reason: '  账务证据已复核  ', evidence: { journal: 'journal:one' } });
    expect(subject).toMatchObject({ kind: 'financerepair', version: 7 });
    expect(decision.reason).toBe('账务证据已复核');
    expect(Object.isFrozen(decision.evidence)).toBe(true);
  });

  it('enforces assignment and requester-checker separation for permission, role, and membership policies', () => {
    const policy = new ApproverPolicy();
    const context = {
      membership: 'membership:checker',
      requester: 'membership:maker',
      principal: 'principal:checker',
      requesterPrincipal: 'principal:maker',
      permissions: new Set(['finance.repair.decide']),
      roles: new Set(['role:finance']),
    };
    expect(() => policy.assertAssigned({ kind: 'permission', value: 'finance.repair.decide' }, context)).not.toThrow();
    expect(() => policy.assertAssigned({ kind: 'role', value: 'role:finance' }, context)).not.toThrow();
    expect(() => policy.assertAssigned({ kind: 'membership', value: 'membership:checker' }, context)).not.toThrow();
    expect(() => policy.assertAssigned({ kind: 'membership', value: 'membership:other' }, context)).toThrowError(/APPROVAL_NOT_ASSIGNED/);
    expect(() => policy.assertAssigned({ kind: 'permission', value: 'finance.repair.decide' }, { ...context, membership: context.requester })).toThrowError(/APPROVAL_SELF_DECISION_FORBIDDEN/);
    expect(() => policy.assertAssigned({ kind: 'permission', value: 'finance.repair.decide' }, { ...context, principal: context.requesterPrincipal })).toThrowError(/APPROVAL_SELF_DECISION_FORBIDDEN/);
    expect(() => policy.assertAssigned({ kind: 'permission', value: 'finance.repair.decide' }, { ...context, requesterPrincipal: '' })).toThrowError(/AUTHORIZATION_DENIED/);
  });

  it('keeps a multi-approver task pending until its threshold and advances only after the whole step is satisfied', () => {
    const task = new ApprovalTask({ id: 'approvaltask:one', state: 'pending', requester: 'membership:maker', dueAt: null, minimumApprovals: 2, approvalCount: 0, version: 1 });
    expect(task.decide('approved', 1, new Date())).toBe('pending');
    const lastVote = new ApprovalTask({ id: task.id, state: 'pending', requester: task.requester, dueAt: null, minimumApprovals: 2, approvalCount: 1, version: 2 });
    expect(lastVote.decide('approved', 2, new Date())).toBe('approved');
    const instance = new ApprovalInstance({ id: 'approvalinstance:one', state: 'pending', requester: 'membership:maker', currentStep: 1, stepCount: 2, expiresAt: null, version: 1 });
    expect(instance.decide('approved', new Date(), false)).toEqual({ state: 'pending', nextStep: 1 });
    expect(instance.decide('approved', new Date(), true)).toEqual({ state: 'pending', nextStep: 2 });
  });

  it('prevents stale, terminal, and expired decisions and resolves configured escalation only after its deadline', () => {
    const now = new Date('2026-09-04T08:00:00.000Z');
    const expired = new ApprovalTask({ id: 'approvaltask:one', state: 'pending', requester: 'membership:maker', dueAt: now, minimumApprovals: 1, approvalCount: 0, version: 3 });
    expect(() => expired.decide('approved', 2, now)).toThrowError(/APPROVAL_TASK_CONFLICT/);
    expect(() => expired.decide('approved', 3, now)).toThrowError(/APPROVAL_INSTANCE_EXPIRED/);
    const policy = new EscalationPolicy();
    expect(policy.next(now, new Date(now.getTime() + 1), 'notify')).toBe('waiting');
    expect(policy.next(now, now, 'reassign')).toBe('reassign');
  });
});
