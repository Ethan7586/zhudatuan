import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchIdentity, type IdentityOperations } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { FederationPort } from '../public';
import { FederationMapper } from './FederationMapper';

export class FederationGateway implements FederationPort {
  private readonly client: IdentityOperations;
  private readonly mapper = new FederationMapper();
  constructor(baseUrl: string) {
    this.client = createFetchIdentity(baseUrl);
  }
  async read(context: ConsoleContext, signal?: AbortSignal) {
    const value = await this.client.providersCenterRead({ query: {} }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.center(value);
  }
  async test(context: ConsoleContext, provider: string, identity: string, signal?: AbortSignal) {
    const value = await this.client.providersTest(
      { path: { providerid: provider }, body: {} },
      consoleCommand(context.scope, { accessVersion: context.session.accessVersion, idempotencyKey: identity, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }), ...(signal === undefined ? {} : { signal }) })
    );
    return this.mapper.health(provider, value);
  }
  createIdentity(): string {
    return createIdempotencyKey();
  }
}
