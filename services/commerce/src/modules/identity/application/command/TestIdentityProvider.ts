import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireAccess, type OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { ProviderResolver } from '../service/ProviderResolver';
export class TestIdentityProvider {
  constructor(private readonly providers: ProviderResolver) {}
  action(): OperationAction {
    return async (request, database) => {
      requireAccess(request);
      const id = request.input.path.providerid;
      if (!/^[0-9a-f-]{36}$/.test(id ?? '')) throw new DomainError('VALIDATION_FAILED');
      const { instance, strategy } = await this.providers.require(database, id!);
      return { status: 200, body: await strategy.health(instance) };
    };
  }
}
