export interface Clock {
  now(): Date;
}

export const SystemClock: Clock = Object.freeze({ now: () => new Date() });
