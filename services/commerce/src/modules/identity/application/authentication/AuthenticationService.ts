import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import type { AuthenticationBody, AuthenticationResolver } from './AuthenticationStrategy';

export class AuthenticationService {
  constructor(private readonly registry: AuthenticationResolver) {}
  action(): OperationAction {
    return async (request, database) => {
      const body = request.input.body as AuthenticationBody;
      const reply = await this.registry.resolve(body.method).authenticate(request, database, body);
      return { status: reply.status, body: reply.result, ...(reply.headers ? { headers: reply.headers } : {}) };
    };
  }
}
