export const WORKER_ENVIRONMENT_KEYS = ['WORKER_READY_FILE'] as const;
export type WorkerEnvironment = Readonly<Partial<Record<(typeof WORKER_ENVIRONMENT_KEYS)[number], string>>>;
