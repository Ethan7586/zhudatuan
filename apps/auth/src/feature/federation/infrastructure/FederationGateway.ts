import type { AuthTarget } from '@shop/config/client';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import type { AuthorizationPort } from '../../../shared/security/Authorization';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { FederationPort } from '../public/FederationPort';
import { mapFederationRedirect, mapProviders } from './FederationMapper';

export class FederationGateway implements FederationPort {
  constructor(private readonly sdk: IdentitySdk, private readonly environment: AuthEnvironment, private readonly bootstrap: BootstrapPort, private readonly authorizations: AuthorizationPort) {}
  read(target: AuthTarget, signal?: AbortSignal) {
    return this.sdk.providersRead({}, queryContext(this.environment, target, signal)).then(mapProviders);
  }
  async start(provider: string, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([this.authorizations.create(), this.bootstrap.read(target, returns, signal)]);
    return this.sdk.federationsStart(
      { body: { providerid: provider, returntarget: bootstrap.returnTarget, authorization: authorization.request } },
      commandContext(this.environment, target, bootstrap.csrf, signal)
    ).then(mapFederationRedirect);
  }
}
