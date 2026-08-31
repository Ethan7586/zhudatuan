import { Deadline, RateLimiter, Semaphore } from '@shop/kernel';
import { IntegrationFailure } from './IntegrationError';

export class RatePolicy {
  private readonly limiter: RateLimiter;
  constructor(
    rate: number,
    capacity = Math.max(1, rate),
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isFinite(rate) || rate <= 0 || !Number.isInteger(capacity) || capacity < 1) throw new Error('PROVIDER_RATE_POLICY_INVALID');
    this.limiter = new RateLimiter(rate, capacity, now);
  }

  acquire(deadline: number): Promise<void> {
    const limit = Deadline.at(deadline, undefined, this.now);
    return this.limiter
      .acquire(limit)
      .catch((cause) => {
        if (cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED') throw new IntegrationFailure('PROVIDER_DEADLINE_EXCEEDED', false, undefined, { cause });
        throw cause;
      })
      .finally(() => limit.dispose());
  }
}

export class ConcurrencyPolicy {
  private readonly semaphore: Semaphore;

  constructor(maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1) throw new Error('PROVIDER_CONCURRENCY_INVALID');
    this.semaphore = new Semaphore(maximum, maximum * 4);
  }

  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    try {
      return await this.semaphore.use(task, signal);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'SEMAPHORE_QUEUE_FULL') throw new IntegrationFailure('PROVIDER_BULKHEAD_REJECTED', true, undefined, { cause });
      throw cause;
    }
  }
}
