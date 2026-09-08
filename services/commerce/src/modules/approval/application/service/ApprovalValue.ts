import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { HandlerContext, WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import { bodyRecord, keysetPage, optionalText, queryPage, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { ApprovalInstance } from '../../domain/model/ApprovalInstance';
import { ApprovalTask } from '../../domain/model/ApprovalTask';
import { ApprovalTemplate, type ApprovalStep } from '../../domain/model/ApprovalTemplate';
import { ApproverPolicy } from '../../domain/policy/ApproverPolicy';
import { ApprovalDecision } from '../../domain/value/ApprovalDecision';
import type { ApprovalSubjectKind } from '../../domain/value/ApprovalSubject';
import type { ApprovalRepository, ApprovalTemplateCommand } from '../port/ApprovalRepository';

export const subjectKinds = new Set<ApprovalSubjectKind>(['voucherstock', 'voucherissue', 'financerepair', 'reconciliation', 'withdrawal', 'refund', 'experiencepublish', 'riskexception', 'riskaction']);

export function approvalSteps(value: unknown): readonly ApprovalStep[] {
  if (!Array.isArray(value)) throw new DomainError('VALIDATION_FAILED');
  return value.map((candidate) => {
    if (!isRecord(candidate) || !Array.isArray(candidate.approvers)) throw new DomainError('VALIDATION_FAILED');
    return {
      sequence: integer(candidate.sequence),
      name: text(candidate.name),
      dueHours: integer(candidate.dueHours),
      approvers: candidate.approvers.map((approver) => {
        if (!isRecord(approver) || !['permission', 'role', 'membership'].includes(String(approver.kind))) throw new DomainError('VALIDATION_FAILED');
        return { kind: approver.kind as 'permission' | 'role' | 'membership', value: text(approver.value), minimumApprovals: integer(approver.minimumApprovals) };
      }),
    };
  });
}

export function approvalEscalations(value: unknown): ApprovalTemplateCommand['escalations'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new DomainError('VALIDATION_FAILED');
  const escalations = value.map((candidate) => {
    if (!isRecord(candidate) || !['notify', 'reassign', 'reject'].includes(String(candidate.action))) throw new DomainError('VALIDATION_FAILED');
    const target = optionalText(candidate, 'target');
    const action = candidate.action as 'notify' | 'reassign' | 'reject';
    const afterHours = integer(candidate.afterHours);
    if (afterHours < 1 || (action === 'reassign') !== (target !== null)) throw new DomainError('VALIDATION_FAILED');
    return { afterHours, action, ...(target === null ? {} : { target }) };
  });
  if (escalations.some((entry, index) => index > 0 && entry.afterHours <= escalations[index - 1]!.afterHours)) throw new DomainError('VALIDATION_FAILED');
  if (escalations.length > 0 && escalations.at(-1)!.action !== 'reject') throw new DomainError('VALIDATION_FAILED');
  return escalations;
}

export function requiredVersion(context: Readonly<{ expectedVersion?: number }>): number {
  if (!Number.isSafeInteger(context.expectedVersion) || (context.expectedVersion ?? 0) < 0) throw new DomainError('EXPECTED_VERSION_REQUIRED');
  return context.expectedVersion!;
}

export function assertBodyVersion(body: Readonly<Record<string, unknown>>, context: Readonly<{ expectedVersion?: number }>): void {
  if (integer(body.expectedVersion) !== requiredVersion(context)) throw new DomainError('EXPECTED_VERSION_INVALID');
}

export function queryText(input: Readonly<{ query?: Readonly<Record<string, unknown>> }>, key: string): string | null {
  const value = input.query?.[key];
  if (value === undefined) return null;
  return text(value);
}

export function objectField(body: Readonly<Record<string, unknown>>, key: string): Readonly<Record<string, unknown>> {
  const value = body[key];
  if (value === undefined) return {};
  if (!isRecord(value)) throw new DomainError('VALIDATION_FAILED');
  return value;
}

export function integer(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DomainError('VALIDATION_FAILED');
  return value as number;
}

export function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DomainError('VALIDATION_FAILED');
  return value.trim();
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
