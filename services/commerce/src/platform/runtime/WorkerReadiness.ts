import { closeSync, openSync, rmSync } from 'node:fs';
import { isAbsolute } from 'node:path';

export class WorkerReadiness {
  constructor(private readonly path = '/tmp/worker-ready') {
    if (!isAbsolute(path) || path === '/') throw new Error('WORKER_READINESS_PATH_INVALID');
  }

  mark(): void {
    closeSync(openSync(this.path, 'wx', 0o400));
  }

  clear(): void {
    rmSync(this.path, { force: true });
  }
}
