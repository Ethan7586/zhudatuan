import { CircuitBreaker, type CircuitState } from '@shop/kernel';
import { IntegrationFailure } from './IntegrationError';

export class CircuitPolicy {
  private readonly breaker: CircuitBreaker;

  constructor(threshold: number, recoveryMs: number, now: () => number = Date.now) {
    if (!Number.isInteger(threshold) || threshold < 1 || !Number.isInteger(recoveryMs) || recoveryMs < 1) throw new Error('PROVIDER_CIRCUIT_POLICY_INVALID');
    this.breaker = new CircuitBreaker(threshold, recoveryMs, now);
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await this.breaker.run(task);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'CIRCUIT_OPEN') throw new IntegrationFailure('PROVIDER_CIRCUIT_OPEN', true, undefined, { cause });
      throw cause;
    }
  }

  snapshot(): CircuitState {
    return this.breaker.snapshot();
  }
}
