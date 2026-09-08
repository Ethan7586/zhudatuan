import { ReturnState } from './ReturnState';

export interface ReturnLine {
  readonly line: string;
  readonly quantity: number;
}
export interface ReturnSnapshot {
  readonly id: string;
  readonly fulfillment: string;
  readonly state: string;
  readonly lines: readonly ReturnLine[];
  readonly fulfilled: readonly ReturnLine[];
  readonly version: number;
}

export class Return {
  private constructor(readonly value: Readonly<ReturnSnapshot>) {}

  static create(value: ReturnSnapshot): Return {
    if (!value.id || !value.fulfillment || !Number.isSafeInteger(value.version) || value.version < 0 || value.lines.length === 0) throw new Error('FULFILLMENT_RETURN_INVALID');
    const fulfilled = new Map(value.fulfilled.map(({ line, quantity }) => [line, quantity]));
    if (new Set(value.lines.map(({ line }) => line)).size !== value.lines.length || value.lines.some(({ line, quantity }) => !line || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > (fulfilled.get(line) ?? 0))) {
      throw new Error('FULFILLMENT_RETURN_QUANTITY_EXCEEDED');
    }
    ReturnState.from(value.state);
    return new Return(Object.freeze({ ...value, lines: Object.freeze(value.lines.map((line) => Object.freeze({ ...line }))), fulfilled: Object.freeze(value.fulfilled.map((line) => Object.freeze({ ...line }))) }));
  }

  receive(): Return {
    return Return.create({ ...this.value, state: ReturnState.from(this.value.state).receive(), version: this.value.version + 1 });
  }
  inspect(accepted: boolean): Return {
    return Return.create({ ...this.value, state: ReturnState.from(this.value.state).inspect(accepted), version: this.value.version + 1 });
  }
}
