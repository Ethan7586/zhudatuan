import type { AuthTarget } from '@shop/config/client';
import { ClientError } from '@shop/sdk';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext, queryContext } from '../../../shared/api/Context';
import { approvedDestination } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { MembershipPort } from '../public/MembershipPort';
import { mapMemberships } from './MembershipMapper';

export class MembershipGateway implements MembershipPort {
  constructor(private readonly sdk: IdentitySdk, private readonly environment: AuthEnvironment, private readonly bootstrap: BootstrapPort) {}
  async read(target: AuthTarget, signal?: AbortSignal) {
    const result = await this.sdk.federationsSelectionRead({}, queryContext(this.environment, target, signal));
    if (result.target !== target) throw new ClientError('RETURN_TARGET_INVALID');
    return mapMemberships(result);
  }
  async select(membership: string, target: AuthTarget, signal?: AbortSignal) {
    const bootstrap = await this.bootstrap.read(target, {}, signal);
    const result = await this.sdk.federationsComplete({ body: { membershipid: membership } }, commandContext(this.environment, target, bootstrap.csrf, signal));
    return Object.freeze({ redirectUrl: approvedDestination(result.location, target, { console: this.environment.consoleOrigin, storefront: this.environment.storefrontOrigin }) });
  }
}
