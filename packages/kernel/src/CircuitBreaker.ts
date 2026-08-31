export type CircuitState = 'closed' | 'open' | 'halfopen';
export interface CircuitObservation {
  readonly previous: CircuitState;
  readonly current: CircuitState;
  readonly failures: number;
}

export class CircuitBreaker {
  private readonly samples: boolean[] = [];
  private openedAt = 0;
  private state: CircuitState = 'closed';
  private probing = false;

  constructor(
    private readonly threshold: number,
    private readonly recoveryMilliseconds: number,
    private readonly now: () => number = Date.now,
    private readonly windowSize = threshold * 2,
    private readonly observe: (value: CircuitObservation) => void = () => undefined
  ) {
    if (!Number.isSafeInteger(threshold) || threshold < 1 || !Number.isSafeInteger(recoveryMilliseconds) || recoveryMilliseconds < 1) {
      throw new Error('CIRCUIT_BREAKER_INVALID');
    }
    if (!Number.isSafeInteger(windowSize) || windowSize < threshold) throw new Error('CIRCUIT_WINDOW_INVALID');
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.before();
    try {
      const result = await operation();
      this.succeed();
      return result;
    } catch (cause) {
      this.fail();
      throw cause;
    }
  }

  snapshot(): CircuitState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.recoveryMilliseconds) return 'halfopen';
    return this.state;
  }

  private before(): void {
    if (this.state === 'open' && this.now() - this.openedAt >= this.recoveryMilliseconds) this.transition('halfopen');
    if (this.state === 'open' || (this.state === 'halfopen' && this.probing)) throw new Error('CIRCUIT_OPEN');
    if (this.state === 'halfopen') this.probing = true;
  }

  private succeed(): void {
    this.probing = false;
    if (this.state === 'halfopen') {
      this.samples.length = 0;
      this.transition('closed');
      return;
    }
    this.record(true);
  }

  private fail(): void {
    this.probing = false;
    this.record(false);
    if (this.state === 'halfopen' || this.failureCount() >= this.threshold) {
      this.transition('open');
      this.openedAt = this.now();
    }
  }

  private record(succeeded: boolean): void {
    this.samples.push(succeeded);
    if (this.samples.length > this.windowSize) this.samples.shift();
  }

  private failureCount(): number {
    return this.samples.filter((succeeded) => !succeeded).length;
  }

  private transition(current: CircuitState): void {
    if (current === this.state) return;
    const previous = this.state;
    this.state = current;
    this.observe(Object.freeze({ previous, current, failures: this.failureCount() }));
  }
}
