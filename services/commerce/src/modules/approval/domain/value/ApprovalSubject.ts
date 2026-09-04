import { DomainError } from '../../../../foundation/domain/DomainError';

export const APPROVAL_SUBJECT_KINDS = Object.freeze([
  'voucherstock',
  'voucherissue',
  'financerepair',
  'reconciliation',
  'withdrawal',
  'refund',
  'experiencepublish',
  'riskexception',
  'riskaction',
] as const);

export type ApprovalSubjectKind = (typeof APPROVAL_SUBJECT_KINDS)[number];

export class ApprovalSubject {
  readonly kind: ApprovalSubjectKind;
  readonly id: string;
  readonly version: number;
  readonly snapshot: Readonly<Record<string, unknown>>;

  constructor(value: Readonly<{ kind: ApprovalSubjectKind; id: string; version: number; snapshot: Readonly<Record<string, unknown>> }>) {
    if (!APPROVAL_SUBJECT_KINDS.includes(value.kind) || value.id.trim().length < 3 || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    this.kind = value.kind;
    this.id = value.id;
    this.version = value.version;
    this.snapshot = Object.freeze({ ...value.snapshot });
    Object.freeze(this);
  }
}
