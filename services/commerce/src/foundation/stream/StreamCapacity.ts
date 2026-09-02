import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../domain/DomainError';

export interface StreamLease {
  release(): void;
}

export class StreamCapacity {
  private total = 0;
  private readonly scopes = new Map<string, number>();

  constructor(
    private readonly maximum: number = RUNTIME_LIMITS.stream.maximumConnections,
    private readonly maximumPerScope: number = RUNTIME_LIMITS.stream.maximumConnectionsPerScope
  ) {
    if (!Number.isSafeInteger(maximum) || maximum < 1 || !Number.isSafeInteger(maximumPerScope) || maximumPerScope < 1 || maximumPerScope > maximum) {
      throw new Error('STREAM_CAPACITY_INVALID');
    }
  }

  acquire(values: readonly string[]): StreamLease {
    const scopes = [...new Set(values)];
    if (scopes.length === 0 || this.total >= this.maximum || scopes.some((scope) => (this.scopes.get(scope) ?? 0) >= this.maximumPerScope)) {
      throw new DomainError('RATE_LIMITED');
    }
    this.total += 1;
    scopes.forEach((scope) => this.scopes.set(scope, (this.scopes.get(scope) ?? 0) + 1));
    let active = true;
    return Object.freeze({
      release: () => {
        if (!active) return;
        active = false;
        this.total -= 1;
        scopes.forEach((scope) => {
          const next = (this.scopes.get(scope) ?? 1) - 1;
          if (next === 0) this.scopes.delete(scope);
          else this.scopes.set(scope, next);
        });
      },
    });
  }
}
