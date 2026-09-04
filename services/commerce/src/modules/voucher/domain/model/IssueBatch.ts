import { DomainError } from '../../../../foundation/domain/DomainError';

export interface IssueBatchValue { readonly id: string; readonly order: string; readonly state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; readonly requested: number; readonly processed: number; readonly succeeded: number; readonly failed: number; readonly retryable: number; readonly version: number; }
export class IssueBatch {
  constructor(readonly value: IssueBatchValue) {
    if (![value.requested, value.processed, value.succeeded, value.failed, value.retryable, value.version].every(Number.isSafeInteger)
      || value.requested <= 0 || value.processed !== value.succeeded + value.failed || value.processed > value.requested || value.retryable > value.failed) throw new DomainError('VOUCHER_STATE_INVALID');
  }
  progress(succeeded: number, failed: number, retryable: number): IssueBatch {
    if (!['queued', 'running'].includes(this.value.state)) throw new DomainError('VOUCHER_STATE_INVALID');
    const processed = this.value.processed + succeeded + failed;
    return new IssueBatch(Object.freeze({ ...this.value, processed, succeeded: this.value.succeeded + succeeded, failed: this.value.failed + failed,
      retryable: this.value.retryable + retryable, state: processed === this.value.requested ? (this.value.failed + failed > 0 ? 'failed' : 'completed') : 'running', version: this.value.version + 1 }));
  }
  retry(): IssueBatch {
    if (this.value.state !== 'failed' || this.value.retryable <= 0) throw new DomainError('VOUCHER_BATCH_NOT_RETRYABLE');
    const permanent = this.value.failed - this.value.retryable;
    return new IssueBatch(Object.freeze({ ...this.value, state: 'queued', processed: this.value.succeeded + permanent, failed: permanent, retryable: 0, version: this.value.version + 1 }));
  }
}
