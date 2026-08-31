import { DomainError } from '../../../../foundation/domain/DomainError';
import type { AuthenticationResolver, AuthenticationStrategy } from '../../application/authentication/AuthenticationStrategy';
import { AuthenticationPolicy } from '../../domain/policy/AuthenticationPolicy';

export class AuthenticationRegistry implements AuthenticationResolver {
  private readonly strategies: ReadonlyMap<string, AuthenticationStrategy>;
  constructor(
    strategies: readonly AuthenticationStrategy[],
    private readonly policy = new AuthenticationPolicy()
  ) {
    this.strategies = new Map(strategies.map((strategy) => [strategy.method, strategy]));
    if (this.strategies.size !== strategies.length) throw new Error('AUTHENTICATION_STRATEGY_DUPLICATE');
    for (const method of ['password', 'otp', 'invitation', 'federation']) if (!this.strategies.has(method)) throw new Error(`AUTHENTICATION_STRATEGY_MISSING:${method}`);
  }
  resolve(method: unknown): AuthenticationStrategy {
    const strategy = this.strategies.get(this.policy.method(method));
    if (!strategy) throw new DomainError('IDENTITY_PROVIDER_INVALID');
    return strategy;
  }
}
