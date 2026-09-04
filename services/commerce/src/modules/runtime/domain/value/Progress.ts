import { DomainError } from '../../../../foundation/domain/DomainError';

export interface ProgressValue {
  readonly processed: number;
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryableItems: number;
}

export class Progress {
  private constructor(readonly value: ProgressValue) {
    Object.freeze(this);
  }

  static restore(value: ProgressValue): Progress {
    const numbers = [value.processed, value.total, value.succeeded, value.failed, value.retryableItems];
    if (numbers.some((item) => !Number.isSafeInteger(item) || item < 0)) throw new DomainError('VALIDATION_FAILED');
    if (value.processed > value.total || value.succeeded + value.failed > value.processed || value.retryableItems > value.failed) {
      throw new DomainError('VALIDATION_FAILED');
    }
    return new Progress(Object.freeze({ ...value }));
  }

  get percent(): number {
    if (this.value.total === 0) return 0;
    return Math.min(100, Math.floor((this.value.processed * 100) / this.value.total));
  }
}
