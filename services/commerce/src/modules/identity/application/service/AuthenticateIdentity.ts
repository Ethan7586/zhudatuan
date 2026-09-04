import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { authenticationOperationResult, type AuthenticationBody, type AuthenticationResolver } from './AuthenticationStrategy';

export class AuthenticateIdentity {
  constructor(private readonly registry: AuthenticationResolver) {}
  action(): OperationAction {
    return async (request, database) => {
      const body = request.input.body as AuthenticationBody;
      const reply = await this.registry.resolve(body.method).authenticate(request, database, body);
      return authenticationOperationResult(reply);
    };
  }
}
