import { Bulkhead } from './Bulkhead';
import { CircuitBreaker } from './CircuitBreaker';
import { Deadline } from './deadline';
import { RateLimiter } from './RateLimiter';
import { retry, type RetryMode } from './Retry';

export type ExecutionMode = RetryMode | 'none';

export interface ExecutionContext {
  readonly mode: ExecutionMode;
  readonly signal?: AbortSignal | undefined;
  readonly deadline?: number | undefined;
  readonly retryable?: (cause: unknown) => boolean;
}

export interface ExecutorPolicy {
  readonly maximumConcurrency: number;
  readonly maximumQueue: number;
  readonly failureThreshold: number;
  readonly recoveryMilliseconds: number;
  readonly requestsPerSecond: number;
  readonly totalDeadlineMilliseconds: number;
  readonly attempts: number;
  readonly retryMinimumMilliseconds: number;
  readonly retryMaximumMilliseconds: number;
}

export class Executor {
  private readonly bulkhead: Bulkhead;
  private readonly circuit: CircuitBreaker;
  private readonly rate: RateLimiter;

  constructor(private readonly policy: ExecutorPolicy) {
    this.bulkhead = new Bulkhead(policy.maximumConcurrency, policy.maximumQueue);
    this.circuit = new CircuitBreaker(policy.failureThreshold, policy.recoveryMilliseconds);
    this.rate = new RateLimiter(policy.requestsPerSecond);
  }

  async run<T>(operation: (deadline: Deadline) => Promise<T>, context: ExecutionContext): Promise<T> {
    const expires = Math.min(context.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + this.policy.totalDeadlineMilliseconds);
    const deadline = Deadline.at(expires, context.signal);
    try {
      await this.rate.acquire(deadline);
      return await this.bulkhead.run(
        () =>
          this.circuit.run(() =>
            context.mode === 'none'
              ? operation(deadline)
              : retry(() => operation(deadline), {
                  mode: context.mode,
                  attempts: this.policy.attempts,
                  minimumDelayMilliseconds: this.policy.retryMinimumMilliseconds,
                  maximumDelayMilliseconds: this.policy.retryMaximumMilliseconds,
                  deadline,
                  retryable: context.retryable ?? (() => false),
                })
          ),
        deadline.signal
      );
    } finally {
      deadline.dispose();
    }
  }

  circuitState(): 'closed' | 'open' | 'halfopen' {
    return this.circuit.snapshot();
  }

  pressure(): Readonly<{ running: number; queued: number; capacity: number }> {
    return this.bulkhead.snapshot();
  }
}
