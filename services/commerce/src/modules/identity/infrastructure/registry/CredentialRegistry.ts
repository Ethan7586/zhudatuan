import { DomainError } from '../../../../platform/error/DomainError';
import type { AuthenticationResolver, AuthenticationStrategy } from '../../application/service/AuthenticationStrategy';
import { AuthenticationPolicy } from '../../domain/policy/AuthenticationPolicy';

type CredentialStrategy = AuthenticationStrategy & Readonly<{ method: 'password' | 'otp' }>;

export class CredentialRegistry implements AuthenticationResolver {
  private readonly strategies: ReadonlyMap<string, CredentialStrategy>;

  constructor(
    strategies: readonly CredentialStrategy[],
    private readonly policy = new AuthenticationPolicy()
  ) {
    this.strategies = new Map(strategies.map((strategy) => [strategy.method, strategy]));
    if (this.strategies.size !== strategies.length) throw new Error('AUTHENTICATION_STRATEGY_DUPLICATE');
    for (const method of ['password', 'otp'] as const) if (!this.strategies.has(method)) throw new Error(`AUTHENTICATION_STRATEGY_MISSING:${method}`);
  }

  resolve(method: unknown): AuthenticationStrategy {
    const strategy = this.strategies.get(this.policy.method(method));
    if (!strategy) throw new DomainError('IDENTITY_PROVIDER_INVALID');
    return strategy;
  }
}
