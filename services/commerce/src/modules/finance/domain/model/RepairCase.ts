import type { FinanceEntryTemplate } from './FinancePolicy';
import { validateEntry } from './FinancePolicy';

export interface RepairDifference {
  readonly id: string;
  readonly kind: string;
  readonly expectedMinor: number;
  readonly actualMinor: number;
  readonly deltaMinor: number;
  readonly currency: string;
}

export class RepairCase {
  constructor(
    readonly id: string,
    readonly statementId: string,
    readonly status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reversed',
    readonly sourceHash: string,
    readonly previewHash: string,
    readonly differences: readonly RepairDifference[],
    readonly entries: readonly FinanceEntryTemplate[],
    readonly makerId: string,
    readonly checkerId: string | null,
    readonly reason: string,
    readonly version: number,
    readonly createdAt: string,
    readonly updatedAt: string
  ) {
    if (
      !id ||
      !statementId ||
      !/^[a-f0-9]{64}$/.test(sourceHash) ||
      !/^[a-f0-9]{64}$/.test(previewHash) ||
      !makerId ||
      !reason ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      Number.isNaN(Date.parse(createdAt)) ||
      Number.isNaN(Date.parse(updatedAt))
    )
      throw new Error('FINANCE_REPAIR_INVALID');
    for (const entry of entries) validateEntry(entry);
    for (const difference of differences) {
      if (
        !difference.id ||
        !difference.kind ||
        !Number.isSafeInteger(difference.expectedMinor) ||
        !Number.isSafeInteger(difference.actualMinor) ||
        difference.deltaMinor !== difference.actualMinor - difference.expectedMinor ||
        difference.currency !== 'CNY'
      )
        throw new Error('FINANCE_REPAIR_DIFFERENCE_INVALID');
    }
    Object.freeze(this.entries);
    Object.freeze(this.differences);
    Object.freeze(this);
  }
}
