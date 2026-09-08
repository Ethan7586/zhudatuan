import { randomUUID } from 'node:crypto';
import { lstatSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export type WorkerWorkload = 'jobs' | 'provider';

export class WorkerReadiness {
  private readonly path: string;
  private token: string | null = null;

  constructor(private readonly workload: WorkerWorkload, configured?: string) {
    this.path = configured ?? join(tmpdir(), `shop${workload}ready`);
    if (!isAbsolute(this.path) || this.path === '/') throw new Error('WORKER_READINESS_PATH_INVALID');
  }

  mark(): void {
    if (this.token !== null) throw new Error('WORKER_READINESS_ALREADY_MARKED');
    const token = randomUUID();
    const marker = JSON.stringify({ version: 1, workload: this.workload, pid: process.pid, token, startedAt: new Date().toISOString() });
    for (;;) {
      try {
        writeFileSync(this.path, marker, { flag: 'wx', mode: 0o400 });
        this.token = token;
        return;
      } catch (error) {
        if (errorCode(error) !== 'EEXIST') throw error;
        let existing: ReadinessMarker;
        try {
          existing = readMarker(this.path);
        } catch (readError) {
          if (errorCode(readError) === 'ENOENT') continue;
          throw readError;
        }
        if (processIsAlive(existing.pid)) throw new Error(`WORKER_READINESS_ACTIVE:${existing.workload}:${existing.pid}`);
        try {
          const current = readMarker(this.path);
          if (current.pid !== existing.pid || current.token !== existing.token) continue;
          rmSync(this.path);
        } catch (removeError) {
          if (errorCode(removeError) !== 'ENOENT') throw removeError;
        }
      }
    }
  }

  clear(): void {
    if (this.token === null) return;
    try {
      const marker = readMarker(this.path);
      if (marker.pid === process.pid && marker.workload === this.workload && marker.token === this.token) rmSync(this.path);
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
    } finally {
      this.token = null;
    }
  }
}

interface ReadinessMarker {
  readonly version: 1;
  readonly workload: WorkerWorkload;
  readonly pid: number;
  readonly token: string;
  readonly startedAt: string;
}

function readMarker(path: string): ReadinessMarker {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('WORKER_READINESS_MARKER_INVALID');
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('WORKER_READINESS_MARKER_INVALID');
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Reflect.get(value, 'version') !== 1 ||
    !['jobs', 'provider'].includes(String(Reflect.get(value, 'workload'))) ||
    !Number.isSafeInteger(Reflect.get(value, 'pid')) ||
    Number(Reflect.get(value, 'pid')) <= 0 ||
    typeof Reflect.get(value, 'token') !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(Reflect.get(value, 'token'))) ||
    typeof Reflect.get(value, 'startedAt') !== 'string' ||
    !Number.isFinite(Date.parse(String(Reflect.get(value, 'startedAt'))))
  )
    throw new Error('WORKER_READINESS_MARKER_INVALID');
  return value as ReadinessMarker;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return false;
    if (errorCode(error) === 'EPERM') return true;
    throw error;
  }
}

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && typeof Reflect.get(error, 'code') === 'string' ? String(Reflect.get(error, 'code')) : undefined;
}
