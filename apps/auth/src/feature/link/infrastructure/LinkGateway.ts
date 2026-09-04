import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import type { AuthorizationPort } from '../../../shared/security/Authorization';
import { approvedProviderRedirect } from '../../../shared/security/ProviderRedirect';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { LinkPort } from '../public/LinkPort';
import { LinkMapper } from './LinkMapper';

export class LinkGateway implements LinkPort {
  constructor(
    private readonly sdk: Pick<IdentitySdk, 'linksRead' | 'linksCreate' | 'linksRevoke'>,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort,
    private readonly authorizations: AuthorizationPort,
    private readonly mapper = new LinkMapper()
  ) {}
  async read(session: SessionRequest, signal: AbortSignal) {
    return this.mapper.map(await this.sdk.linksRead({}, queryContext(this.environment, session.target, signal)));
  }
  async create(provider: string, session: SessionRequest, signal: AbortSignal) {
    const [authorization, bootstrap] = await Promise.all([this.authorizations.create(), this.bootstrap.read(session, signal)]);
    const result = await this.sdk.linksCreate(
      { body: { providerid: provider, returntarget: bootstrap.returnTarget, authorization: authorization.request } },
      commandContext(this.environment, session.target, bootstrap.csrf, signal)
    );
    return Object.freeze({ redirectUrl: approvedProviderRedirect(result.location) });
  }
  async revoke(link: string, session: SessionRequest, signal: AbortSignal): Promise<void> {
    const bootstrap = await this.bootstrap.read(session, signal);
    await this.sdk.linksRevoke({ path: { linkid: link }, body: {} }, commandContext(this.environment, session.target, bootstrap.csrf, signal));
  }
}
