import { DomainError } from '../../../../platform/error/DomainError';
import { Progress, type ProgressValue } from '../value/Progress';
import { RetryPolicy } from '../policy/RetryPolicy';

export type RuntimeTaskType = 'job' | 'import' | 'export';
export type RuntimeTaskState = 'queued' | 'validating' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface RuntimeTaskData extends ProgressValue {
  readonly id: string;
  readonly type: RuntimeTaskType;
  readonly owner: string;
  readonly kind: string;
  readonly title: string;
  readonly state: RuntimeTaskState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
  readonly fileName: string | null;
  readonly downloadAvailable: boolean;
  readonly cancelRequested: boolean;
  readonly confirmationRequired: boolean;
  readonly previewHash: string | null;
  readonly columns: readonly string[];
  readonly validationErrors: number;
}

export type RuntimeTaskSnapshot = Omit<RuntimeTaskData, 'cancelRequested'> & Readonly<{ cancellable: boolean; retryable: boolean }>;

export class RuntimeTask {
  readonly progress: Progress;

  constructor(
    private readonly data: RuntimeTaskData,
    private readonly retryPolicy = new RetryPolicy()
  ) {
    if (
      !/^(job|import|export):/.test(data.id) ||
      !data.owner ||
      !data.kind ||
      !data.title ||
      !Number.isSafeInteger(data.version) ||
      data.version < 1 ||
      Number.isNaN(Date.parse(data.createdAt)) ||
      Number.isNaN(Date.parse(data.updatedAt)) ||
      (data.expiresAt !== null && Number.isNaN(Date.parse(data.expiresAt))) ||
      !TASK_STATES[data.type].has(data.state) ||
      !data.id.startsWith(`${data.type}:`) ||
      (data.previewHash !== null && !/^[a-f0-9]{64}$/.test(data.previewHash)) ||
      !Number.isSafeInteger(data.validationErrors) ||
      data.validationErrors < 0
    ) {
      throw new DomainError('VALIDATION_FAILED');
    }
    this.progress = Progress.restore(data);
    Object.freeze(this);
  }

  snapshot(): RuntimeTaskSnapshot {
    const { cancelRequested: _cancelRequested, ...data } = this.data;
    return Object.freeze({
      ...data,
      cancellable: this.canCancel(),
      retryable: this.retryPolicy.canRetry(this.data.type, this.data.state),
    });
  }

  assertCancellation(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (!this.canCancel()) throw new DomainError('VALIDATION_FAILED', { state: this.data.state });
  }

  assertRetry(expectedVersion: number): void {
    this.assertVersion(expectedVersion);
    if (!this.retryPolicy.canRetry(this.data.type, this.data.state)) throw new DomainError('VALIDATION_FAILED', { state: this.data.state });
  }

  private canCancel(): boolean {
    if (this.data.cancelRequested) return false;
    if (this.data.type === 'job') return this.data.state === 'queued' || this.data.state === 'running';
    if (this.data.type === 'import') return ['queued', 'validating', 'ready', 'running'].includes(this.data.state);
    return this.data.state === 'queued' || this.data.state === 'running';
  }

  private assertVersion(expectedVersion: number): void {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    if (this.data.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
  }
}

const TASK_STATES: Readonly<Record<RuntimeTaskType, ReadonlySet<RuntimeTaskState>>> = Object.freeze({
  job: new Set<RuntimeTaskState>(['queued', 'running', 'completed', 'failed', 'cancelled']),
  import: new Set<RuntimeTaskState>(['queued', 'validating', 'ready', 'running', 'completed', 'failed', 'cancelled', 'expired']),
  export: new Set<RuntimeTaskState>(['queued', 'running', 'completed', 'failed', 'cancelled', 'expired']),
});
