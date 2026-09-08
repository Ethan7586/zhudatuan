import type { ModuleWorker } from '../../../../pipeline/ModuleWorker';

export interface RegisteredWorker extends ModuleWorker {
  readonly owner: string;
}

export class WorkerRegistry {
  private readonly workers = new Map<string, RegisteredWorker>();
  private frozen = false;

  register(owner: string, declared: readonly string[], binding: ModuleWorker): void {
    if (this.frozen) throw new Error('WORKER_REGISTRY_FROZEN');
    if (!declared.includes(binding.id)) throw new Error(`WORKER_UNDECLARED:${owner}:${binding.id}`);
    if (this.workers.has(binding.id)) throw new Error(`WORKER_DUPLICATE:${binding.id}`);
    if (!/^[a-z][a-z0-9]*$/.test(binding.id) || !/^[a-z]+$/.test(owner) || typeof binding.worker?.run !== 'function') {
      throw new Error(`WORKER_INVALID:${owner}:${binding.id}`);
    }
    this.workers.set(binding.id, Object.freeze({ id: binding.id, owner, worker: binding.worker }));
  }

  freeze(expected: readonly Readonly<{ owner: string; id: string }>[]): void {
    if (this.frozen) throw new Error('WORKER_REGISTRY_FROZEN');
    const declared = expected.map(({ owner, id }) => `${owner}:${id}`).sort();
    const registered = [...this.workers.values()].map(({ owner, id }) => `${owner}:${id}`).sort();
    if (new Set(declared).size !== declared.length) throw new Error('WORKER_DECLARATION_DUPLICATE');
    if (declared.join(',') !== registered.join(',')) throw new Error(`WORKER_REGISTRY_INCOMPLETE:${registered.length}:${declared.length}`);
    this.frozen = true;
  }

  all(): readonly RegisteredWorker[] {
    if (!this.frozen) throw new Error('WORKER_REGISTRY_NOT_FROZEN');
    return Object.freeze([...this.workers.values()]);
  }
}
