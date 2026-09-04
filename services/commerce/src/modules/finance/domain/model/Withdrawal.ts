import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { SettlementPolicy } from '../policy/SettlementPolicy';

export type WithdrawalState = 'submitted' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'uncertain' | 'cancelled';

export interface WithdrawalValue {
  readonly id: string;
  readonly scopeId: string;
  readonly settlementId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly destinationRef: string;
  readonly state: WithdrawalState;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly providerReference: string | null;
  readonly version: number;
}

export class Withdrawal {
  private constructor(private readonly value: WithdrawalValue) {
    if (!value.id || !value.scopeId || !value.settlementId || !value.destinationRef || !value.requestedBy || value.destinationRef.length > 256) {
      throw new DomainError('VALIDATION_FAILED', { field: 'withdrawal' });
    }
    if (Money.of(value.amountMinor, value.currency as 'CNY').minor <= 0 || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    }
    if (value.approvedBy !== null && value.approvedBy === value.requestedBy) throw new DomainError('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static submit(input: Readonly<Omit<WithdrawalValue, 'state' | 'approvedBy' | 'providerReference' | 'version'>>): Withdrawal {
    return new Withdrawal({ ...input, state: 'submitted', approvedBy: null, providerReference: null, version: 0 });
  }

  static restore(value: WithdrawalValue): Withdrawal {
    return new Withdrawal({ ...value });
  }

  decide(checkerId: string, approved: boolean, policy = new SettlementPolicy()): Withdrawal {
    if (this.value.state !== 'submitted') throw new DomainError('VERSION_CONFLICT');
    policy.assertDecision(this.value.requestedBy, checkerId, this.value.amountMinor);
    return new Withdrawal({ ...this.value, state: approved ? 'approved' : 'rejected', approvedBy: checkerId, version: this.value.version + 1 });
  }

  process(): Withdrawal {
    if (!['approved', 'processing'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    return this.value.state === 'processing' ? this : new Withdrawal({ ...this.value, state: 'processing', version: this.value.version + 1 });
  }

  fail(uncertain: boolean): Withdrawal {
    if (this.value.state !== 'processing') throw new DomainError('VERSION_CONFLICT');
    return new Withdrawal({ ...this.value, state: uncertain ? 'uncertain' : 'failed', version: this.value.version + 1 });
  }

  recover(): Withdrawal {
    if (!['failed', 'uncertain'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    return new Withdrawal({ ...this.value, state: 'approved', providerReference: null, version: this.value.version + 1 });
  }

  paid(providerReference: string): Withdrawal {
    if (this.value.state !== 'processing' || !providerReference.trim()) throw new DomainError('VERSION_CONFLICT');
    return new Withdrawal({ ...this.value, state: 'paid', providerReference: providerReference.trim(), version: this.value.version + 1 });
  }

  snapshot(): WithdrawalValue {
    return this.value;
  }
}
