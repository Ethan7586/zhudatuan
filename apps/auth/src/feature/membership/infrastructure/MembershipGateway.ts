import { ClientError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import { approvedDestination } from '../../../shared/security/ReturnTarget';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { MembershipPort } from '../public/MembershipPort';
import { mapMemberships } from './MembershipMapper';

export class MembershipGateway implements MembershipPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort
  ) {}
  async read(session: SessionRequest, signal?: AbortSignal) {
    const result = await this.sdk.federationsSelectionRead({}, queryContext(this.environment, session.target, signal));
    if (result.target !== session.target) throw new ClientError('RETURN_TARGET_INVALID');
    return mapMemberships(result);
  }
  async select(membership: string, session: SessionRequest, signal?: AbortSignal) {
    const bootstrap = await this.bootstrap.read(session, signal);
    const result = await this.sdk.federationsComplete({ body: { membershipid: membership } }, commandContext(this.environment, session.target, bootstrap.csrf, signal));
    return Object.freeze({ redirectUrl: approvedDestination(result.location, session.target, this.environment.returnOrigins) });
  }
}
