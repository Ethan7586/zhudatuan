import { TestClock } from './TestClock';

export class ClockHarness extends TestClock {
  set(value: Date): void {
    const current = this.now().getTime();
    const target = value.getTime();
    if (!Number.isFinite(target) || target < current) throw new Error('CLOCK_HARNESS_SET_INVALID');
    this.advance(target - current);
  }
}
