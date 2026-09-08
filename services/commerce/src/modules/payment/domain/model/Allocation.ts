import { DomainError } from '../../../../platform/error/DomainError';

export interface AllocationLine {
  readonly sequence: number;
  readonly kind: 'wechat' | 'benefit' | 'voucher';
  readonly reference: string | null;
  readonly amountMinor: number;
}

export class Allocation {
  constructor(
    readonly lines: readonly AllocationLine[],
    readonly totalMinor: number
  ) {
    if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || lines.some((line) => !Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0)) throw new DomainError('VALIDATION_FAILED');
    if (new Set(lines.map(({ sequence }) => sequence)).size !== lines.length || lines.reduce((sum, line) => sum + line.amountMinor, 0) !== totalMinor) throw new DomainError('PAYMENT_ALLOCATION_UNBALANCED');
    if (lines.some((line) => (line.kind === 'wechat') !== (line.reference === null))) throw new DomainError('PAYMENT_ALLOCATION_UNBALANCED');
  }
}
