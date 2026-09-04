import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { Bulkhead } from './Bulkhead';
import { CircuitBreaker } from './CircuitBreaker';
import { Deadline } from './Deadline';
import { RateLimiter } from './RateLimiter';
import { retry, type RetryMode } from './Retry';

export type ExecutionMode = RetryMode | 'none';

export interface ExecutionContext {
  readonly mode: ExecutionMode;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
  readonly retryable?: (cause: unknown) => boolean;
}

export class Executor {
  private readonly bulkhead = new Bulkhead(RUNTIME_LIMITS.external.maximumConcurrency, RUNTIME_LIMITS.external.maximumQueue);
  private readonly circuit = new CircuitBreaker(RUNTIME_LIMITS.external.failureThreshold, RUNTIME_LIMITS.external.recoveryMilliseconds);
  private readonly rate = new RateLimiter(RUNTIME_LIMITS.external.requestsPerSecond);

  async run<T>(operation: (deadline: Deadline) => Promise<T>, context: ExecutionContext): Promise<T> {
    const expires = Math.min(context.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + RUNTIME_LIMITS.external.totalDeadlineMilliseconds);
    const deadline = Deadline.at(expires, context.signal);
    try {
      await this.rate.acquire(deadline);
      return await this.bulkhead.run(() => this.circuit.run(() => context.mode === 'none' ? operation(deadline) : retry(() => operation(deadline), {
        mode: context.mode,
        attempts: RUNTIME_LIMITS.external.attempts,
        minimumDelayMilliseconds: RUNTIME_LIMITS.external.retryMinimumMilliseconds,
        maximumDelayMilliseconds: RUNTIME_LIMITS.external.retryMaximumMilliseconds,
        deadline,
        retryable: context.retryable ?? (() => false),
      })), deadline.signal);
    } finally {
      deadline.dispose();
    }
  }
}
