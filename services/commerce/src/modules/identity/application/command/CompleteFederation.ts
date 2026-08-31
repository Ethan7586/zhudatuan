import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { FederationService } from '../service/FederationService';
import { requestContext } from './StartFederation';
export class CompleteFederation {
  constructor(private readonly federation: FederationService) {}
  action(): OperationAction {
    return (request, database) => {
      const state = query(request, 'state', 256);
      const code = query(request, 'code', 512);
      const provider = request.input.path.providerid;
      if (!/^[0-9a-f-]{36}$/.test(provider ?? '')) throw new DomainError('VALIDATION_FAILED');
      return this.federation.callback(database, { provider: provider!, state, code }, requestContext(request));
    };
  }
}
function query(request: Parameters<OperationAction>[0], key: string, maximum: number): string {
  const value = request.input.query[key];
  if (typeof value !== 'string' || !value || value.length > maximum || !/^[A-Za-z0-9._~-]+$/.test(value)) throw new DomainError('VALIDATION_FAILED');
  return value;
}
