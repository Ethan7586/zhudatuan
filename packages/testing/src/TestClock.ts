import type { Clock } from '@shop/kernel';

export class TestClock implements Clock {
  private value: Date;

  constructor(initial = new Date('2026-01-01T00:00:00.000Z')) {
    this.value = new Date(initial);
  }

  now(): Date {
    return new Date(this.value);
  }

  advance(milliseconds: number): void {
    if (!Number.isSafeInteger(milliseconds)) throw new Error('TEST_CLOCK_ADVANCE_INVALID');
    this.value = new Date(this.value.getTime() + milliseconds);
  }
}
