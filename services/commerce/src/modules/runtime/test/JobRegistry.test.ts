import { describe, expect, it } from 'vitest';
import { JobRegistry } from '../application/registry/JobRegistry';

const definition = Object.freeze({
  id: 'cleanup',
  job: Object.freeze({ id: 'cleanup', execute: async () => undefined }),
  lease: 90,
  batch: 10,
  concurrency: 2,
  deadline: 60_000,
});

describe('Runtime JobRegistry', () => {
  it('registers each processor strategy once and freezes the composition', () => {
    const registry = new JobRegistry();
    registry.register(definition);
    expect(() => registry.register(definition)).toThrow('JOB_DUPLICATE:cleanup');
    registry.freeze();
    expect(registry.all()).toEqual([definition]);
    expect(() => registry.register({ ...definition, id: 'unknown' })).toThrow('JOB_REGISTRY_FROZEN');
  });

  it('rejects unknown processors and owner drift in projected task labels', () => {
    const registry = new JobRegistry();
    expect(() => registry.register({ ...definition, id: 'unknown' })).toThrow('JOB_KIND_UNKNOWN:unknown');
    expect(() => registry.title('catalog', 'cleanup')).toThrow('JOB_OWNER_MISMATCH:cleanup:catalog:runtime');
  });
});
