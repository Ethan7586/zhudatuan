import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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
      expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ version: 1, workload: 'jobs', pid: process.pid });
      expect(() => readiness.mark()).toThrow('WORKER_READINESS_ALREADY_MARKED');
      readiness.clear();
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a non-absolute marker path', () => {
    expect(() => new WorkerReadiness('jobs', 'ready')).toThrow('WORKER_READINESS_PATH_INVALID');
  });

  it('reclaims a marker only after its owning process has exited', () => {
    const directory = mkdtempSync(join(tmpdir(), 'shop-worker-'));
    const path = join(directory, 'ready');
    try {
      const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
      if (!child.pid) throw new Error('WORKER_READINESS_TEST_PID_MISSING');
      writeMarker(path, 'provider', child.pid);
      const readiness = new WorkerReadiness('provider', path);
      readiness.mark();
      expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ workload: 'provider', pid: process.pid });
      readiness.clear();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never replaces a marker owned by an active process', () => {
    const directory = mkdtempSync(join(tmpdir(), 'shop-worker-'));
    const path = join(directory, 'ready');
    try {
      writeMarker(path, 'provider', process.pid);
      expect(() => new WorkerReadiness('provider', path).mark()).toThrow(`WORKER_READINESS_ACTIVE:provider:${process.pid}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not remove a marker that no longer belongs to this instance', () => {
    const directory = mkdtempSync(join(tmpdir(), 'shop-worker-'));
    const path = join(directory, 'ready');
    try {
      const readiness = new WorkerReadiness('jobs', path);
      readiness.mark();
      rmSync(path);
      writeMarker(path, 'jobs', process.pid);
      readiness.clear();
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('fails closed for an unsigned legacy or malformed marker', () => {
    const directory = mkdtempSync(join(tmpdir(), 'shop-worker-'));
    const path = join(directory, 'ready');
    try {
      writeFileSync(path, '');
      expect(() => new WorkerReadiness('jobs', path).mark()).toThrow('WORKER_READINESS_MARKER_INVALID');
      expect(existsSync(path)).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function writeMarker(path: string, workload: 'jobs' | 'provider', pid: number): void {
  writeFileSync(path, JSON.stringify({ version: 1, workload, pid, token: randomUUID(), startedAt: new Date().toISOString() }), { mode: 0o400 });
}
