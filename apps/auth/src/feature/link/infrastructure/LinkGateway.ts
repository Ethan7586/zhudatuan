import type { AuthTarget } from '@shop/config/client';
import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { queryContext } from '../../../shared/api/Context';
import type { LinkPort } from '../public/LinkPort';
import { LinkMapper } from './LinkMapper';

export class LinkGateway implements LinkPort {
  constructor(private readonly sdk: Pick<IdentitySdk, 'linksRead'>, private readonly environment: AuthEnvironment, private readonly mapper = new LinkMapper()) {}
  async read(target: AuthTarget, signal: AbortSignal) { return this.mapper.map(await this.sdk.linksRead({}, queryContext(this.environment, target, signal))); }
}
