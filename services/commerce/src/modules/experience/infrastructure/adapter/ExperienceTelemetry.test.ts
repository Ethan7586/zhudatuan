import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { ExperienceTelemetry } from './ExperienceTelemetry';

describe('ExperienceTelemetry', () => {
  it('emits the entry catalog without handle, mall or member labels', () => {
    const count = vi.fn();
    const duration = vi.fn();
    const telemetry = new ExperienceTelemetry({ metrics: { count, duration } } as never);
    const context = transaction();

    telemetry.resolve(context, { cache: 'miss', result: 'failure', milliseconds: 12, errorCode: 'STOREFRONT_NOT_FOUND' });
    telemetry.states(context, { ready: 2, unpublished: 1, disabled: 0, invalid: 1 });

    expect(duration).toHaveBeenCalledWith('experience.entry.resolve.duration', 12, expect.objectContaining({ target: 'miss', result: 'failure' }));
    expect(count).toHaveBeenCalledWith('experience.entry.resolve.failure', 1, expect.any(Object));
    expect(count).toHaveBeenCalledWith('experience.entry.state', 2, expect.objectContaining({ result: 'ready' }));
    for (const call of [...duration.mock.calls, ...count.mock.calls]) {
      expect(call[2]).not.toHaveProperty('scopeId');
      expect(call[2]).not.toHaveProperty('membershipId');
      expect(call[2]).not.toHaveProperty('resourceId');
    }
  });

  it('records publication activation with bounded labels', () => {
    const duration = vi.fn();
    const telemetry = new ExperienceTelemetry({ metrics: { count: vi.fn(), duration } } as never);
    telemetry.publication({ trace: 'trace:publish', result: 'success', milliseconds: 42 });
    expect(duration).toHaveBeenCalledWith('experience.publication.activate.duration', 42, {
      requestId: 'trace:publish',
      traceId: 'trace:publish',
      module: 'experience',
      operation: 'job.experience.activate',
      result: 'success',
    });
  });
});

function transaction(): ReadTransactionContext {
  return { trace: 'trace:entry', operation: 'storefront.bootstrap.read' } as ReadTransactionContext;
}
