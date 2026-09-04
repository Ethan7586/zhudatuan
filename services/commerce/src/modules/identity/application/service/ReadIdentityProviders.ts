import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { DomainError } from '../../../../foundation/domain/DomainError';

import type { ProviderRepository } from '../port/ProviderRepository';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import { isOperationTarget } from '@shop/contract';
export class ReadIdentityProviders {
  constructor(
    private readonly providers: ProviderRepository,
    private readonly targets: ReturnTargetPort
  ) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const value = request.input.query.returntarget;
      const requested = request.input.headers['x-client-target'];
      if (!isOperationTarget(requested)) throw new DomainError('VALIDATION_FAILED');
      if (value !== undefined && typeof value !== 'string') throw new DomainError('VALIDATION_FAILED');
      const target = value === undefined ? undefined : this.targets.verify(value);
      if (target !== undefined && target.target !== requested) throw new DomainError('VALIDATION_FAILED');
      const items = await this.providers.list(database, target?.tenant);
      return {
        status: 200,
        body: { items },
      };
    };
  }
}
