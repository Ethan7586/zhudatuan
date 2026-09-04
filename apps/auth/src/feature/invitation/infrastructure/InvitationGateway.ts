import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext } from '../../../shared/api/Context';
import { exchangeSession } from '../../../shared/api/Exchange';
import { createAuthorization } from '../../../shared/security/Authorization';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { InvitationResolution } from '../model/Invitation';
import type { InvitationPort } from '../public/InvitationPort';
import { mapInvitation } from './InvitationMapper';

export class InvitationGateway implements InvitationPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort
  ) {}
  async resolve(input: InvitationResolution) {
    const [authorization, bootstrap] = await Promise.all([createAuthorization(), this.bootstrap.read(input.session, input.signal)]);
    const result = await this.sdk.invitationsResolve(
      { body: { code: input.code.trim(), target: input.session.target, returnTarget: bootstrap.returnTarget, authorization: authorization.request } },
      commandContext(this.environment, input.session.target, bootstrap.csrf, input.signal)
    );
    if (result.kind !== 'session') return mapInvitation(result);
    const redirectUrl = await exchangeSession(this.sdk, this.environment, result, authorization, input.session.target, bootstrap.csrf, input.signal);
    return Object.freeze({ kind: 'authenticated' as const, redirectUrl });
  }
}
