import { errorCause } from '../ErrorCause';

const MAX_TIMER_MILLISECONDS = 2_147_483_647;

export class Deadline {
  readonly expiresAt: number;
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly detach?: () => void;

  private constructor(expiresAt: number, parent?: AbortSignal, private readonly now: () => number = Date.now) {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) throw new Error('DEADLINE_INVALID');
    this.expiresAt = expiresAt;
    this.signal = this.controller.signal;
    const expire = () => this.controller.abort(new Error('DEADLINE_EXCEEDED'));
    const delay = Math.max(0, Math.min(MAX_TIMER_MILLISECONDS, expiresAt - now()));
    this.timer = setTimeout(expire, delay);
    this.timer.unref?.();
    if (parent) {
      const abort = () => this.controller.abort(errorCause(parent.reason, 'REQUEST_ABORTED'));
      if (parent.aborted) abort();
      else {
        parent.addEventListener('abort', abort, { once: true });
        this.detach = () => parent.removeEventListener('abort', abort);
      }
    }
  }

  static after(milliseconds: number, parent?: AbortSignal, now: () => number = Date.now): Deadline {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 1) throw new Error('DEADLINE_DURATION_INVALID');
    return new Deadline(now() + milliseconds, parent, now);
  }

  static at(expiresAt: number, parent?: AbortSignal, now: () => number = Date.now): Deadline {
    return new Deadline(expiresAt, parent, now);
  }

  remaining(): number {
    return Math.max(0, this.expiresAt - this.now());
  }

  throwIfExpired(): void {
    if (this.signal.aborted || this.remaining() === 0) throw errorCause(this.signal.reason, 'DEADLINE_EXCEEDED');
  }

  child(maximumMilliseconds: number): Deadline {
    if (!Number.isSafeInteger(maximumMilliseconds) || maximumMilliseconds < 1) throw new Error('DEADLINE_DURATION_INVALID');
    return Deadline.at(Math.min(this.expiresAt, this.now() + maximumMilliseconds), this.signal, this.now);
  }

  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.throwIfExpired();
    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(errorCause(this.signal.reason, 'DEADLINE_EXCEEDED'));
      this.signal.addEventListener('abort', abort, { once: true });
      operation(this.signal).then(resolve, reject).finally(() => this.signal.removeEventListener('abort', abort));
    });
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.detach?.();
  }
}
