export interface RetryDecision {
  readonly retry: boolean;
  readonly delayMs: number;
}

export class RetryPolicy {
  constructor(private readonly attempts = 3, private readonly baseDelayMs = 80) {
    if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('RETRY_ATTEMPTS_INVALID');
  }

  decide(attempt: number, status?: number): RetryDecision {
    const retryable = status === undefined || status === 408 || status === 429 || status >= 500;
    if (!retryable || attempt >= this.attempts) return { retry: false, delayMs: 0 };
    return { retry: true, delayMs: Math.min(this.baseDelayMs * 2 ** (attempt - 1), 1_000) };
  }
}
