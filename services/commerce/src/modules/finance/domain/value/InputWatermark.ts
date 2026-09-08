import { DomainError } from '../../../../platform/error/DomainError';

export interface InputWatermarkValue {
  readonly hash: string;
  readonly count: number;
  readonly occurredAt: string;
}

/** Immutable evidence that binds a long-running finance process to one source snapshot. */
export class InputWatermark {
  private constructor(private readonly value: InputWatermarkValue) {
    if (!/^[a-f0-9]{64}$/.test(value.hash) || !Number.isSafeInteger(value.count) || value.count < 1 || Number.isNaN(Date.parse(value.occurredAt))) {
      throw new DomainError('VALIDATION_FAILED', { field: 'inputWatermark' });
    }
    Object.freeze(this.value);
    Object.freeze(this);
  }

  static restore(value: InputWatermarkValue): InputWatermark {
    return new InputWatermark({ ...value });
  }

  assert(hash: string, count: number): void {
    if (this.value.hash !== hash || this.value.count !== count) throw new Error('FINANCE_INPUT_SNAPSHOT_CHANGED');
  }

  snapshot(): InputWatermarkValue {
    return this.value;
  }
}
