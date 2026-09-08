import { closeSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export type WorkerWorkload = 'jobs' | 'provider';

export class WorkerReadiness {
  private readonly path: string;

  constructor(workload: WorkerWorkload, configured?: string) {
    this.path = configured ?? join(tmpdir(), `shop${workload}ready`);
    if (!isAbsolute(this.path) || this.path === '/') throw new Error('WORKER_READINESS_PATH_INVALID');
  }

  mark(): void {
    closeSync(openSync(this.path, 'wx', 0o400));
  }

  clear(): void {
    rmSync(this.path, { force: true });
  }
}
