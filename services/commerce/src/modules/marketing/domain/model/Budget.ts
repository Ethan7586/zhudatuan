import { DomainError } from '../../../../foundation/domain/DomainError';

export interface BudgetSnapshot {
  readonly campaign: string;
  readonly limitMinor: number;
  readonly spentMinor: number;
  readonly version: number;
}

export class Budget {
  private constructor(private readonly value: BudgetSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static restore(value: BudgetSnapshot): Budget {
    return new Budget(Object.freeze({ ...value }));
  }

  reserve(amountMinor: number): Budget {
    amount(amountMinor);
    if (amountMinor > this.available()) throw new DomainError('MARKETING_BUDGET_CONFLICT');
    return new Budget(Object.freeze({ ...this.value, spentMinor: this.value.spentMinor + amountMinor, version: this.value.version + 1 }));
  }

  replenish(amountMinor: number): Budget {
    amount(amountMinor);
    if (amountMinor > this.value.spentMinor) throw new DomainError('MARKETING_BUDGET_CONFLICT');
    return new Budget(Object.freeze({ ...this.value, spentMinor: this.value.spentMinor - amountMinor, version: this.value.version + 1 }));
  }

  available(): number {
    return this.value.limitMinor - this.value.spentMinor;
  }

  snapshot(): BudgetSnapshot {
    return this.value;
  }
}

function validate(value: BudgetSnapshot): void {
  if (!value.campaign || !Number.isSafeInteger(value.limitMinor) || value.limitMinor < 0 || !Number.isSafeInteger(value.spentMinor) || value.spentMinor < 0 || value.spentMinor > value.limitMinor) {
    throw new DomainError('VALIDATION_FAILED', { field: 'budget' });
  }
  if (!Number.isSafeInteger(value.version) || value.version < 1) throw new DomainError('VALIDATION_FAILED', { field: 'budget.version' });
}
function amount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new DomainError('VALIDATION_FAILED', { field: 'budget.amountMinor' });
}
