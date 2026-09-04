import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import type { AuthorizationPort } from '../../../shared/security/Authorization';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { FederationPort } from '../public/FederationPort';
import { mapFederationRedirect, mapProviders } from './FederationMapper';

export class FederationGateway implements FederationPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort,
    private readonly authorizations: AuthorizationPort
  ) {}
  async read(session: SessionRequest, signal?: AbortSignal) {
    const bootstrap = await this.bootstrap.read(session, signal);
    return this.sdk.providersRead({ query: { returntarget: bootstrap.returnTarget } }, queryContext(this.environment, session.target, signal)).then(mapProviders);
  }
  async start(provider: string, session: SessionRequest, signal?: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([this.authorizations.create(), this.bootstrap.read(session, signal)]);
    return this.sdk
      .federationsStart({ body: { providerid: provider, returntarget: bootstrap.returnTarget, authorization: authorization.request } }, commandContext(this.environment, session.target, bootstrap.csrf, signal))
      .then(mapFederationRedirect);
  }
}
