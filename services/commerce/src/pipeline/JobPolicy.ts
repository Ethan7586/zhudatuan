export interface JobCatalogEntry {
  readonly id: string;
  readonly owner: string;
  readonly queue: string;
  readonly concurrency: number;
  readonly timeout: number;
  readonly retry: Readonly<{ attempts: number; minimum: number; maximum: number; jitter: true }>;
  readonly lease: number;
  readonly idempotency: 'jobid';
  readonly deadLetter: 'runtime.deadletters';
  readonly runbook: string;
  readonly worker: string;
}

export function registerJob<const T extends JobCatalogEntry>(definition: T): Readonly<T> {
  return Object.freeze(definition);
}

export const worker = 'services/commerce/src/modules/runtime/public/JobProcess.ts';
export const deadLetter = 'runtime.deadletters' as const;
export const retry = Object.freeze({ attempts: 8, minimum: 250, maximum: 60_000, jitter: true as const });
export const retry5 = Object.freeze({ attempts: 5, minimum: 250, maximum: 60_000, jitter: true as const });
export const retry3 = Object.freeze({ attempts: 3, minimum: 250, maximum: 30_000, jitter: true as const });
