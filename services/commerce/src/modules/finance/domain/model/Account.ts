import { Currency } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { AccountCode, type AccountKind } from '../value/AccountCode';

export type AccountState = 'active' | 'closed';

export interface AccountValue {
  readonly id: string;
  readonly scopeId: string;
  readonly code: AccountCode;
  readonly currency: Currency;
  readonly state: AccountState;
}

export class Account {
  private constructor(private readonly value: AccountValue) {
    if (!value.id || !value.scopeId) throw new DomainError('VALIDATION_FAILED', { field: 'account' });
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static create(id: string, scopeId: string, code: string, currency: string, kind: AccountKind): Account {
    return new Account({ id, scopeId, code: AccountCode.of(code, kind), currency: Currency.of(currency), state: 'active' });
  }

  static restore(input: Readonly<{ id: string; scopeId: string; code: string; currency: string; kind: AccountKind; state: AccountState }>): Account {
    return new Account({ id: input.id, scopeId: input.scopeId, code: AccountCode.of(input.code, input.kind), currency: Currency.of(input.currency), state: input.state });
  }

  close(): Account {
    return this.value.state === 'closed' ? this : new Account({ ...this.value, state: 'closed' });
  }

  assertPostable(): void {
    if (this.value.state !== 'active') throw new DomainError('VALIDATION_FAILED', { field: 'accountState', state: this.value.state });
  }

  snapshot(): AccountValue {
    return this.value;
  }
}
