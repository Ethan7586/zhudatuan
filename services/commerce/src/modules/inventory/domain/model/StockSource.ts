import { DomainError } from '../../../../platform/error/DomainError';

export interface StockSourceSnapshot {
  readonly id: string;
  readonly stockitem: string;
  readonly provider: string;
  readonly reference: string;
  readonly onhand: number;
  readonly observedAt: string;
  readonly state: 'active' | 'blocked' | 'stale';
  readonly version: number;
}

export class StockSource {
  private constructor(private readonly value: StockSourceSnapshot) {
    if (!/^source:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !/^stock:/.test(value.stockitem) || !value.provider || !value.reference) invalid('identity');
    if (!Number.isSafeInteger(value.onhand) || value.onhand < 0) invalid('onhand');
    if (Number.isNaN(Date.parse(value.observedAt))) invalid('observedAt');
    if (!['active', 'blocked', 'stale'].includes(value.state) || !Number.isSafeInteger(value.version) || value.version < 1) invalid('state');
    Object.freeze(this);
  }

  static observe(input: Omit<StockSourceSnapshot, 'state' | 'version'>): StockSource {
    return new StockSource(Object.freeze({ ...input, observedAt: new Date(input.observedAt).toISOString(), state: 'active', version: 1 }));
  }

  snapshot(): StockSourceSnapshot {
    return this.value;
  }
}

function invalid(field: string): never {
  throw new DomainError('INVENTORY_BALANCE_INVALID', { field });
}
