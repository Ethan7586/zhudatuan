import { ClientError } from '@shop/sdk';
import type { Authorization } from './Authorization';

export interface AuthorizationJourneyPort {
  remember(reference: string, expiresAt: string, authorization: Authorization): void;
  require(reference: string): Authorization;
  clear(reference: string): void;
}

interface PendingAuthorization {
  readonly authorization: Authorization;
  readonly expiresAt: number;
}

export class AuthorizationJourney implements AuthorizationJourneyPort {
  private readonly pending = new Map<string, PendingAuthorization>();

  constructor(private readonly now: () => number = Date.now) {}

  remember(reference: string, expiresAt: string, authorization: Authorization): void {
    this.prune();
    const expiry = Date.parse(expiresAt);
    if (reference.trim() === '' || !Number.isFinite(expiry) || expiry <= this.now()) throw new ClientError('SESSION_CONTEXT_MISSING');
    this.pending.set(reference, Object.freeze({ authorization, expiresAt: expiry }));
  }

  require(reference: string): Authorization {
    this.prune();
    const entry = this.pending.get(reference);
    if (entry === undefined) throw new ClientError('SESSION_CONTEXT_MISSING');
    return entry.authorization;
  }

  clear(reference: string): void {
    this.pending.delete(reference);
  }

  private prune(): void {
    const now = this.now();
    for (const [reference, entry] of this.pending) if (entry.expiresAt <= now) this.pending.delete(reference);
  }
}
