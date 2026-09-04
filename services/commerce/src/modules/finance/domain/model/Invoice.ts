import { Money } from '@shop/kernel';
import { DomainError } from '../../../../foundation/domain/DomainError';

export type InvoiceState = 'submitted' | 'approved' | 'issuing' | 'issued' | 'rejected' | 'cancelled' | 'failed' | 'red';
export type InvoiceKind = 'original' | 'red';

export interface InvoiceLine {
  readonly id: string;
  readonly description: string;
  readonly amountMinor: number;
  readonly taxMinor: number;
}

export interface InvoiceValue {
  readonly id: string;
  readonly profileId: string;
  readonly settlementId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly kind: InvoiceKind;
  readonly redOf: string | null;
  readonly state: InvoiceState;
  readonly lines: readonly InvoiceLine[];
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly version: number;
}

export class Invoice {
  private constructor(private readonly value: InvoiceValue) {
    if (!value.id || !value.profileId || !value.settlementId || !value.requestedBy || value.lines.length === 0 || value.lines.length > 1_000) {
      throw new DomainError('VALIDATION_FAILED', { field: 'invoice' });
    }
    const amount = Money.of(value.amountMinor, value.currency as 'CNY');
    const total = value.lines.reduce((sum, line) => {
      if (!line.id || !line.description.trim() || !Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0 || !Number.isSafeInteger(line.taxMinor) || line.taxMinor < 0 || line.taxMinor > line.amountMinor) {
        throw new DomainError('VALIDATION_FAILED', { field: 'invoiceLine' });
      }
      return sum.add(Money.of(line.amountMinor, value.currency as 'CNY'));
    }, Money.zero(value.currency as 'CNY'));
    if (amount.minor <= 0 || !amount.equals(total) || (value.kind === 'original' && value.redOf !== null) || (value.kind === 'red' && !value.redOf) || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new DomainError('VALIDATION_FAILED', { field: 'invoiceAmount' });
    }
    if (['approved', 'issuing', 'issued'].includes(value.state) && !value.approvedBy) throw new DomainError('VALIDATION_FAILED', { field: 'approvedBy' });
    if (value.approvedBy !== null && value.approvedBy === value.requestedBy) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    Object.freeze(this.value.lines);
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static submit(input: Readonly<Omit<InvoiceValue, 'state' | 'approvedBy' | 'version'>>): Invoice {
    return new Invoice({ ...input, lines: Object.freeze([...input.lines]), state: 'submitted', approvedBy: null, version: 0 });
  }

  static restore(value: InvoiceValue): Invoice {
    return new Invoice({ ...value, lines: Object.freeze([...value.lines]) });
  }

  decide(checkerId: string, approved: boolean): Invoice {
    if (!['submitted', 'failed'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    if (!checkerId || checkerId === this.value.requestedBy) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    return new Invoice({ ...this.value, state: approved ? 'approved' : 'rejected', approvedBy: checkerId, version: this.value.version + 1 });
  }

  cancel(): Invoice {
    if (this.value.state !== 'submitted') throw new DomainError('VERSION_CONFLICT');
    return new Invoice({ ...this.value, state: 'cancelled', version: this.value.version + 1 });
  }

  beginIssue(): Invoice {
    if (!['approved', 'issuing'].includes(this.value.state)) throw new DomainError('VERSION_CONFLICT');
    return this.value.state === 'issuing' ? this : new Invoice({ ...this.value, state: 'issuing', version: this.value.version + 1 });
  }

  issue(): Invoice {
    if (this.value.state !== 'issuing') throw new DomainError('VERSION_CONFLICT');
    return new Invoice({ ...this.value, state: 'issued', version: this.value.version + 1 });
  }

  markRed(): Invoice {
    if (this.value.kind !== 'original' || this.value.state !== 'issued') throw new DomainError('VERSION_CONFLICT');
    return new Invoice({ ...this.value, state: 'red', version: this.value.version + 1 });
  }

  snapshot(): InvoiceValue {
    return this.value;
  }
}
