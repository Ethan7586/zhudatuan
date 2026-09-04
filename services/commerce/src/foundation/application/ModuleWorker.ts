export interface TechnicalWorker {
  run(signal: AbortSignal): Promise<void>;
}

export interface ModuleWorker {
  readonly id: string;
  readonly worker: TechnicalWorker;
}

export interface ModuleWorkers {
  add(binding: ModuleWorker): void;
}
