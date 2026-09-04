import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchOrganization, type OrganizationOperations } from '@shop/sdk/organization';
import { createFetchPartner, type PartnerOperations } from '@shop/sdk/partner';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { PartnerChange, PartnerKind } from '../model/Partner';
import type { StoreChange } from '../model/Store';
import type { PartnerPort } from '../public';
import { PartnerMapper } from './PartnerMapper';

export class PartnerGateway implements PartnerPort {
  private readonly partners: PartnerOperations;
  private readonly organizations: OrganizationOperations;
  private readonly mapper = new PartnerMapper();
  constructor(baseUrl: string) {
    this.partners = createFetchPartner(baseUrl);
    this.organizations = createFetchOrganization(baseUrl);
  }

  async readPartners(context: ConsoleContext, kind: PartnerKind, cursor?: string, signal?: AbortSignal) {
    const value = await this.partners.partnersRead({ query: { kind, limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.partners(value);
  }

  async readStores(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.organizations.storesRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.stores(value);
  }

  async managePartner(context: ConsoleContext, change: PartnerChange, identity: string, signal?: AbortSignal) {
    const value = await this.partners.partnersManage({ path: { partnerid: change.id }, body: { kind: change.kind, name: change.name.trim(), status: change.status } }, command(context, change.version, identity, signal));
    return this.mapper.partnerReceipt(value);
  }

  async manageStore(context: ConsoleContext, change: StoreChange, identity: string, signal?: AbortSignal) {
    const value = await this.organizations.storesManage(
      {
        path: { storeid: change.id },
        body: {
          name: change.name.trim(),
          status: change.status,
          regionCode: change.regionCode.trim(),
          mall: change.mallId,
          serviceRadiusMeters: change.serviceRadiusMeters,
          ...(change.address === undefined ? {} : { address: change.address }),
        },
      },
      command(context, change.version, identity, signal)
    );
    return this.mapper.storeReceipt(value);
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
  createReference(kind: PartnerKind | 'store'): string {
    return `${kind}:${crypto.randomUUID()}`;
  }
}

function command(context: ConsoleContext, version: number, identity: string, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: version,
    idempotencyKey: identity,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}
