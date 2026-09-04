import { describe, expect, it } from 'vitest';
import { RuntimeTask, type RuntimeTaskData } from './Task';

describe('RuntimeTask', () => {
  it('uses one monotonic cancellation policy for jobs, imports and exports', () => {
    expect(task({ type: 'job', state: 'queued' }).snapshot().cancellable).toBe(true);
    expect(task({ type: 'import', state: 'validating' }).snapshot().cancellable).toBe(true);
    expect(task({ type: 'export', state: 'completed' }).snapshot().cancellable).toBe(false);
    expect(task({ type: 'job', state: 'running', cancelRequested: true }).snapshot().cancellable).toBe(false);
  });

  it('allows retry only for failed imports at the exact persisted version', () => {
    const failed = task({ type: 'import', state: 'failed', version: 3 });
    expect(failed.snapshot().retryable).toBe(true);
    expect(() => failed.assertRetry(2)).toThrow('VERSION_CONFLICT');
    expect(() => task({ type: 'job', state: 'failed' }).assertRetry(1)).toThrow('VALIDATION_FAILED');
  });

  it('rejects zero versions because the public contract is strictly positive', () => {
    expect(() => task({ version: 0 })).toThrow('VALIDATION_FAILED');
    expect(() => task({ version: 1 }).assertCancellation(0)).toThrow('EXPECTED_VERSION_REQUIRED');
  });

  it('rejects states that do not belong to the concrete task strategy', () => {
    expect(() => task({ type: 'job', state: 'ready' })).toThrow('VALIDATION_FAILED');
    expect(() => task({ type: 'export', state: 'validating' })).toThrow('VALIDATION_FAILED');
    expect(() => task({ type: 'import', state: 'ready' })).not.toThrow();
  });
});

function task(change: Partial<RuntimeTaskData> = {}): RuntimeTask {
  const type = change.type ?? 'job';
  return new RuntimeTask({
    id: `${type}:00000000-0000-4000-8000-000000000001`,
    type,
    owner: 'runtime',
    kind: 'cleanup',
    title: '运行时清理',
    state: 'queued',
    processed: 0,
    total: 0,
    succeeded: 0,
    failed: 0,
    retryableItems: 0,
    version: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    expiresAt: null,
    fileName: null,
    downloadAvailable: false,
    cancelRequested: false,
    confirmationRequired: false,
    previewHash: null,
    columns: [],
    validationErrors: 0,
    ...change,
  });
}
