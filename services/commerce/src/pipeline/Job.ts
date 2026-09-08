export interface JobContext {
  readonly id: string;
  readonly attempt: number;
  readonly signal: AbortSignal;
}

export interface Job<T = unknown> {
  readonly id: string;
  execute(input: T, context: JobContext): Promise<void>;
}
