import { Money } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { SettlementPolicy, type SettlementSplit } from '../policy/SettlementPolicy';

export type SettlementState = 'draft' | 'approved' | 'payable' | 'paid' | 'cancelled';

export interface SettlementValue {
  readonly id: string;
  readonly scopeId: string;
  readonly reconciliationId: string;
  readonly partnerId: string;
  readonly period: string;
  readonly currency: string;
  readonly grossMinor: number;
  readonly feeMinor: number;
  readonly amountMinor: number;
  readonly invoiceBasis: 'gross' | 'net';
  readonly state: SettlementState;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly version: number;
}

export class Settlement {
  private constructor(private readonly value: SettlementValue) {
    if (!value.id || !value.scopeId || !value.reconciliationId || !value.partnerId || !value.period || !value.requestedBy) {
      throw new DomainError('VALIDATION_FAILED', { field: 'settlement' });
    }
    Money.of(value.grossMinor, value.currency as 'CNY');
    Money.of(value.feeMinor, value.currency as 'CNY');
    Money.of(value.amountMinor, value.currency as 'CNY');
    if (value.grossMinor <= 0 || value.feeMinor < 0 || value.amountMinor <= 0 || value.amountMinor !== value.grossMinor - value.feeMinor || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('FINANCE_SETTLEMENT_AMOUNT_INVALID');
    }
    if (value.approvedBy !== null && value.approvedBy === value.requestedBy) throw new DomainError('FINANCE_SETTLEMENT_SEPARATION_REQUIRED');
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static draft(input: Readonly<Omit<SettlementValue, 'state' | 'approvedBy' | 'version'>>): Settlement {
    return new Settlement({ ...input, state: 'draft', approvedBy: null, version: 0 });
  }

  static fromSplit(input: Readonly<Omit<SettlementValue, 'grossMinor' | 'feeMinor' | 'amountMinor' | 'invoiceBasis' | 'state' | 'approvedBy' | 'version'>>, split: SettlementSplit): Settlement {
    return Settlement.draft({ ...input, grossMinor: split.grossMinor, feeMinor: split.feeMinor, amountMinor: split.netMinor, invoiceBasis: split.invoiceBasis });
  }

  static restore(value: SettlementValue): Settlement {
    return new Settlement({ ...value });
  }

  approve(checkerId: string, policy = new SettlementPolicy()): Settlement {
    if (this.value.state !== 'draft') throw new DomainError('VERSION_CONFLICT');
    policy.assertDecision(this.value.requestedBy, checkerId, this.value.amountMinor);
    return new Settlement({ ...this.value, state: 'payable', approvedBy: checkerId, version: this.value.version + 1 });
  }

  cancel(): Settlement {
    if (this.value.state !== 'draft') throw new DomainError('VERSION_CONFLICT');
    return new Settlement({ ...this.value, state: 'cancelled', version: this.value.version + 1 });
  }

  adjust(grossMinor: number, rule: unknown, policy = new SettlementPolicy()): Settlement {
    if (this.value.state !== 'draft') throw new DomainError('VERSION_CONFLICT');
    const split = policy.split(grossMinor, rule);
    return new Settlement({ ...this.value, grossMinor: split.grossMinor, feeMinor: split.feeMinor, amountMinor: split.netMinor, invoiceBasis: split.invoiceBasis, version: this.value.version + 1 });
  }

  pay(): Settlement {
    if (!['approved', 'payable'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    return new Settlement({ ...this.value, state: 'paid', version: this.value.version + 1 });
  }

  snapshot(): SettlementValue {
    return this.value;
  }
}
