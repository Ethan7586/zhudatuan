import { identityLifecycle, type IdentityLifecycle } from '../model/IdentityAction';
import { authenticationOperationResult, type AuthenticationBody, type AuthenticationResolver, type LoadedAuthentication, type PreparedAuthentication } from './AuthenticationStrategy';

export class AuthenticateIdentity {
  constructor(private readonly registry: AuthenticationResolver) {}

  lifecycle(): IdentityLifecycle<PreparedAuthentication, LoadedAuthentication> {
    return identityLifecycle({
      load: async (request, database) => {
        const body = request.input.body as AuthenticationBody;
        return this.registry.resolve(body.method).load(request, database, body);
      },
      prepare: async (request, loaded) => loaded.prepare(request, request.input.body as AuthenticationBody),
      execute: async (request, database, prepared) => {
        const reply = await prepared.authenticate(request, database);
        return authenticationOperationResult(reply);
      },
    });
  }
}
