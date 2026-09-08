import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkerReadiness } from './WorkerReadiness';

describe('worker readiness marker', () => {
  it('publishes readiness only after bootstrap and clears it during shutdown', () => {
    const directory = mkdtempSync(join(tmpdir(), 'shop-worker-'));
    const path = join(directory, 'ready');
    try {
      const readiness = new WorkerReadiness('jobs', path);
      readiness.mark();
      expect(existsSync(path)).toBe(true);
      expect(() => readiness.mark()).toThrow();
      readiness.clear();
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a non-absolute marker path', () => {
    expect(() => new WorkerReadiness('jobs', 'ready')).toThrow('WORKER_READINESS_PATH_INVALID');
  });
});
