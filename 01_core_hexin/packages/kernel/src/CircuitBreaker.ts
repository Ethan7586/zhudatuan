export type CircuitState = 'closed' | 'open' | 'halfopen';

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: CircuitState = 'closed';
  private probing = false;

  constructor(private readonly threshold: number, private readonly recoveryMilliseconds: number, private readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(threshold) || threshold < 1 || !Number.isSafeInteger(recoveryMilliseconds) || recoveryMilliseconds < 1) {
      throw new Error('CIRCUIT_BREAKER_INVALID');
    }
  }

  async run<T>(operation: () => Promise<T>, countsAsFailure: (cause: unknown) => boolean = () => true): Promise<T> {
    this.before();
    try {
      const result = await operation();
      this.succeed();
      return result;
    } catch (cause) {
      if (countsAsFailure(cause)) this.fail();
      else this.succeed();
      throw cause;
    }
  }

  snapshot(): CircuitState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.recoveryMilliseconds) return 'halfopen';
    return this.state;
  }

  private before(): void {
    if (this.state === 'open' && this.now() - this.openedAt >= this.recoveryMilliseconds) this.state = 'halfopen';
    if (this.state === 'open' || (this.state === 'halfopen' && this.probing)) throw new Error('CIRCUIT_OPEN');
    if (this.state === 'halfopen') this.probing = true;
  }

  private succeed(): void {
    this.failures = 0;
    this.probing = false;
    this.state = 'closed';
  }

  private fail(): void {
    this.probing = false;
    this.failures += 1;
    if (this.state === 'halfopen' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = this.now();
    }
  }
}
