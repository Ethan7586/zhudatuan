import type { ApprovalDecisionRecord, ApprovalInstanceRecord, ApprovalProofRecord, ApprovalTaskRecord, ApprovalTemplateRecord, ApprovalTemplateVersionRecord } from '../../application/port/ApprovalRepository';

export interface TemplateRow extends Omit<ApprovalTemplateRecord, 'createdAt' | 'updatedAt'> {
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

export interface VersionRow extends Omit<ApprovalTemplateVersionRecord, 'createdAt'> {
  readonly createdAt: Date | string;
}

export interface TaskRow extends Omit<ApprovalTaskRecord, 'dueAt' | 'decidedAt'> {
  readonly dueAt: Date | string | null;
  readonly decidedAt: Date | string | null;
}

export interface DecisionRow extends Omit<ApprovalDecisionRecord, 'decidedAt' | 'proof'> {
  readonly decidedAt: Date | string;
}

export interface ProofRow extends Omit<ApprovalProofRecord, 'issuedAt' | 'expiresAt'> {
  readonly issuedAt: Date | string;
  readonly expiresAt: Date | string;
}

export interface ActiveTemplateRow extends VersionRow {
  readonly scopeId: string;
}

export interface DueTaskRow extends TaskRow {
  readonly scopeId: string;
  readonly escalationAction: 'notify' | 'reassign' | 'reject';
  readonly escalationTarget: string | null;
}

export interface InstanceRow extends Omit<ApprovalInstanceRecord, 'createdAt' | 'decidedAt' | 'expiresAt' | 'tasks' | 'decisions'> {
  readonly createdAt: Date | string;
  readonly decidedAt: Date | string | null;
  readonly expiresAt: Date | string | null;
}

export function template(row: TemplateRow): ApprovalTemplateRecord {
  return Object.freeze({ ...row, createdAt: utc(row.createdAt), updatedAt: utc(row.updatedAt) });
}

export function templateVersion(row: VersionRow): ApprovalTemplateVersionRecord {
  return Object.freeze({ ...row, steps: Object.freeze(row.steps), escalations: Object.freeze(row.escalations), createdAt: utc(row.createdAt) });
}

export function task(row: TaskRow): ApprovalTaskRecord {
  return Object.freeze({ ...row, dueAt: nullableUtc(row.dueAt), decidedAt: nullableUtc(row.decidedAt) });
}

export function decisionRecord(row: DecisionRow, token: string | null): ApprovalDecisionRecord {
  return Object.freeze({ ...row, proof: token, evidence: Object.freeze({ ...row.evidence }), decidedAt: utc(row.decidedAt) });
}

export function instance(row: InstanceRow): Omit<ApprovalInstanceRecord, 'tasks' | 'decisions'> {
  return Object.freeze({
    ...row,
    subjectSnapshot: Object.freeze({ ...row.subjectSnapshot }),
    constraints: Object.freeze({ ...row.constraints }),
    createdAt: utc(row.createdAt),
    decidedAt: nullableUtc(row.decidedAt),
    expiresAt: nullableUtc(row.expiresAt),
  });
}

export function proof(row: ProofRow): ApprovalProofRecord {
  return Object.freeze({ ...row, constraints: Object.freeze({ ...row.constraints }), issuedAt: utc(row.issuedAt), expiresAt: utc(row.expiresAt) });
}

export function nestedEscalation(row: DueTaskRow): Readonly<{ action: 'notify' | 'reassign' | 'reject'; target?: string }> {
  return Object.freeze({ action: row.escalationAction, ...(row.escalationTarget === null ? {} : { target: row.escalationTarget }) });
}

export function utc(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('APPROVAL_TIME_INVALID');
  return date.toISOString();
}

export function nullableUtc(value: Date | string | null): string | null {
  return value === null ? null : utc(value);
}

export function required<T>(value: T | undefined, code: string): T {
  if (value === undefined) throw new Error(code);
  return value;
}
