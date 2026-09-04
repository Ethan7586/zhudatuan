import { describe, expect, it } from 'vitest';
import { WorkerRegistry } from '../application/registry/WorkerRegistry';

const worker = Object.freeze({ run: async () => undefined });

describe('Runtime WorkerRegistry', () => {
  it('registers each manifest-declared technical worker exactly once', () => {
    const registry = new WorkerRegistry();
    registry.register('runtime', ['outboxrelay', 'scheduler'], { id: 'outboxrelay', worker });
    registry.register('runtime', ['outboxrelay', 'scheduler'], { id: 'scheduler', worker });
    registry.freeze([{ owner: 'runtime', id: 'outboxrelay' }, { owner: 'runtime', id: 'scheduler' }]);
    expect(registry.all().map(({ id }) => id)).toEqual(['outboxrelay', 'scheduler']);
    expect(() => registry.register('runtime', ['cleanup'], { id: 'cleanup', worker })).toThrow('WORKER_REGISTRY_FROZEN');
  });

  it('rejects undeclared, duplicate and incomplete registration', () => {
    const undeclared = new WorkerRegistry();
    expect(() => undeclared.register('runtime', ['scheduler'], { id: 'outboxrelay', worker })).toThrow('WORKER_UNDECLARED');
    const duplicate = new WorkerRegistry();
    duplicate.register('runtime', ['scheduler'], { id: 'scheduler', worker });
    expect(() => duplicate.register('runtime', ['scheduler'], { id: 'scheduler', worker })).toThrow('WORKER_DUPLICATE');
    expect(() => duplicate.freeze([{ owner: 'runtime', id: 'scheduler' }, { owner: 'runtime', id: 'outboxrelay' }]))
      .toThrow('WORKER_REGISTRY_INCOMPLETE:1:2');
  });
});
