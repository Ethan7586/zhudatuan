import { DomainError } from '../../../../foundation/domain/DomainError';

export interface ActionBatchValue { readonly id: string; readonly snapshot: string; readonly action: 'activate' | 'disable' | 'enable' | 'void' | 'extend'; readonly state: 'queued' | 'running' | 'completed' | 'failed'; readonly requested: number; readonly processed: number; readonly succeeded: number; readonly failed: number; readonly retryable: number; readonly version: number; }
export class ActionBatch {
  constructor(readonly value: ActionBatchValue) {
    if (value.requested <= 0 || value.processed !== value.succeeded + value.failed || value.processed > value.requested || value.retryable > value.failed) throw new DomainError('VOUCHER_STATE_INVALID');
  }
  retry(): ActionBatch {
    if (this.value.state !== 'failed' || this.value.retryable === 0) throw new DomainError('VOUCHER_BATCH_NOT_RETRYABLE');
    const permanent = this.value.failed - this.value.retryable;
    return new ActionBatch(Object.freeze({ ...this.value, state: 'queued', processed: this.value.succeeded + permanent, failed: permanent, retryable: 0, version: this.value.version + 1 }));
  }
}
