import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { randomBytes } from 'node:crypto';

import type { ProviderRepository } from '../port/ProviderRepository';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
export class ReadIdentityProviders {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly targets: ReturnTargetPort
  ) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const value = request.input.query.returntarget;
      const requested = request.input.headers['x-client-target'];
      if (requested !== 'console' && requested !== 'storefront') throw new DomainError('VALIDATION_FAILED');
      const target = typeof value === 'string' ? this.targets.verify(value) : this.targets.issue(requested);
      if (target.target !== requested) throw new Error('AUTH_RETURN_TARGET_INVALID');
      const items = await this.providers.list(database, target.tenant);
      const csrf = randomBytes(32).toString('base64url');
      return {
        status: 200,
        body: { items, csrf, target: target.target, returnTarget: target.proof },
        headers: {
          'set-cookie': `__Host-auth-csrf=${csrf}; Path=/; Max-Age=600; Secure; SameSite=Strict`,
        },
      };
    };
  }
}
