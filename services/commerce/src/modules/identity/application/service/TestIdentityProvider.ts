import { identityLifecycle as operationLifecycle, type IdentityLifecycle as OperationLifecycle } from '../model/IdentityAction';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireAccess } from '../../../../pipeline/OperationAccess';

import type { ProviderResolver } from '../service/ProviderResolver';
import type { OperationResult } from '../../../../pipeline/OperationRequest';

type LoadedProvider = Awaited<ReturnType<ProviderResolver['require']>>;

export class TestIdentityProvider {
  constructor(private readonly providers: ProviderResolver) {}

  lifecycle(): OperationLifecycle<OperationResult, LoadedProvider> {
    return operationLifecycle({
      load: (request, database) => {
        requireAccess(request);
        const id = request.input.path.providerid;
        if (!/^[0-9a-f-]{36}$/.test(id ?? '')) throw new DomainError('VALIDATION_FAILED');
        return this.providers.require(database, id!);
      },
      prepare: async (_request, loaded) => ({ status: 200, body: await loaded.strategy.health(loaded.instance) }),
      execute: async (_request, _database, prepared) => prepared,
    });
  }
}
