export interface SingleflightObservation {
  readonly key: string;
  readonly shared: boolean;
  readonly outcome: 'success' | 'failure' | 'cancelled';
  readonly milliseconds: number;
}

export type SingleflightObserver = (observation: SingleflightObservation) => void;

interface Flight<T> {
  readonly controller: AbortController;
  readonly promise: Promise<T>;
  waiters: number;
  complete: boolean;
}

export class Singleflight {
  private readonly flights = new Map<string, Flight<unknown>>();

  constructor(private readonly observe?: SingleflightObserver) {}

  run<T>(key: string, operation: (signal: AbortSignal) => Promise<T>, options: Readonly<{ signal?: AbortSignal | undefined; deadline?: number | undefined }> = {}): Promise<T> {
    if (!key.trim()) return Promise.reject(new Error('SINGLEFLIGHT_KEY_INVALID'));
    let flight = this.flights.get(key) as Flight<T> | undefined;
    const shared = flight !== undefined;
    if (!flight) {
      const controller = new AbortController();
      flight = {
        controller,
        waiters: 0,
        complete: false,
        promise: operation(controller.signal).finally(() => {
          flight!.complete = true;
          if (this.flights.get(key) === flight) this.flights.delete(key);
        }),
      };
      this.flights.set(key, flight as Flight<unknown>);
    }
    flight.waiters += 1;
    return this.wait(key, flight, shared, options);
  }

  private async wait<T>(key: string, flight: Flight<T>, shared: boolean, options: Readonly<{ signal?: AbortSignal | undefined; deadline?: number | undefined }>): Promise<T> {
    const started = performance.now();
    const controller = new AbortController();
    const timer = options.deadline === undefined ? undefined : setTimeout(() => controller.abort(new Error('DEADLINE_EXCEEDED')), Math.max(0, options.deadline - Date.now()));
    timer?.unref?.();
    const abort = () => controller.abort(options.signal?.reason ?? new Error('OPERATION_ABORTED'));
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    try {
      const value = await Promise.race([flight.promise, cancelled(controller.signal)]);
      this.observe?.({ key, shared, outcome: 'success', milliseconds: performance.now() - started });
      return value;
    } catch (cause) {
      this.observe?.({ key, shared, outcome: controller.signal.aborted ? 'cancelled' : 'failure', milliseconds: performance.now() - started });
      throw cause;
    } finally {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      flight.waiters -= 1;
      if (flight.waiters === 0 && !flight.complete) flight.controller.abort(new Error('SINGLEFLIGHT_NO_WAITERS'));
    }
  }
}

function cancelled(signal: AbortSignal): Promise<never> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
}
