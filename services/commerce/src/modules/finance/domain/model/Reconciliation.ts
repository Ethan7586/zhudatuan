import { DomainError } from '../../../../platform/error/DomainError';

export type ReconciliationState = 'received' | 'matching' | 'balanced' | 'difference' | 'resolved' | 'approved';

export interface ReconciliationValue {
  readonly id: string;
  readonly scopeId: string;
  readonly provider: string;
  readonly partnerId: string;
  readonly period: string;
  readonly statementRef: string;
  readonly statementHash: string;
  readonly state: ReconciliationState;
  readonly externalMinor: number;
  readonly internalMinor: number;
  readonly differenceMinor: number;
  readonly differenceCount: number;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly version: number;
}

export class Reconciliation {
  private constructor(private readonly value: ReconciliationValue) {
    if (!value.id || !value.scopeId || !value.provider || !value.partnerId || !value.statementRef || !value.requestedBy || !/^[a-f0-9]{64}$/.test(value.statementHash)) {
      throw new DomainError('VALIDATION_FAILED', { field: 'reconciliation' });
    }
    if (
      ![value.externalMinor, value.internalMinor, value.differenceMinor, value.differenceCount, value.version].every(Number.isSafeInteger) ||
      value.differenceMinor !== value.externalMinor - value.internalMinor ||
      value.differenceCount < 0 ||
      value.version < 0
    ) {
      throw new DomainError('VALIDATION_FAILED', { field: 'reconciliationTotals' });
    }
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static receive(input: Omit<ReconciliationValue, 'state' | 'externalMinor' | 'internalMinor' | 'differenceMinor' | 'differenceCount' | 'approvedBy' | 'version'>): Reconciliation {
    return new Reconciliation({ ...input, state: 'received', externalMinor: 0, internalMinor: 0, differenceMinor: 0, differenceCount: 0, approvedBy: null, version: 0 });
  }

  static restore(value: ReconciliationValue): Reconciliation {
    return new Reconciliation({ ...value });
  }

  startMatching(): Reconciliation {
    if (!['received', 'matching', 'difference'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    return this.value.state === 'matching' ? this : new Reconciliation({ ...this.value, state: 'matching', version: this.value.version + 1 });
  }

  complete(externalMinor: number, internalMinor: number, differenceCount: number): Reconciliation {
    if (this.value.state !== 'matching' || ![externalMinor, internalMinor, differenceCount].every(Number.isSafeInteger) || differenceCount < 0) {
      throw new DomainError('VERSION_CONFLICT');
    }
    const differenceMinor = externalMinor - internalMinor;
    const state = differenceMinor === 0 && differenceCount === 0 ? 'balanced' : 'difference';
    return new Reconciliation({ ...this.value, externalMinor, internalMinor, differenceMinor, differenceCount, state, version: this.value.version + 1 });
  }

  resolve(externalMinor: number, internalMinor: number, unresolvedCount: number): Reconciliation {
    if (this.value.state !== 'difference' || externalMinor !== internalMinor || unresolvedCount !== 0) throw new DomainError('VERSION_CONFLICT');
    return new Reconciliation({ ...this.value, externalMinor, internalMinor, differenceMinor: 0, differenceCount: 0, state: 'resolved', version: this.value.version + 1 });
  }

  approve(checkerId: string): Reconciliation {
    if (!['balanced', 'resolved'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    if (!checkerId || checkerId === this.value.requestedBy) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    return new Reconciliation({ ...this.value, state: 'approved', approvedBy: checkerId, version: this.value.version + 1 });
  }

  snapshot(): ReconciliationValue {
    return this.value;
  }
}
