import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchOrganization, type OrganizationOperations } from '@shop/sdk/organization';
import { createFetchPartner, type PartnerOperations } from '@shop/sdk/partner';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { PartnerChange, PartnerKind } from '../model/Partner';
import type { StoreChange } from '../model/Store';
import type { CustomerChange, CustomerQuery } from '../model/Customer';
import type { PartnerPort } from '../public';
import { PartnerMapper } from './PartnerMapper';
import { customerBody } from './PartnerSchema';

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

  async readCustomers(context: ConsoleContext, query: CustomerQuery, signal?: AbortSignal) {
    const value = await this.partners.customersList(
      { query: { limit: 50, ...(query.q === undefined ? {} : { q: query.q }), ...(query.kind === undefined ? {} : { kind: query.kind }), ...(query.status === undefined ? {} : { status: query.status }), ...(query.cursor === undefined ? {} : { cursor: query.cursor }) } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.customers(value);
  }

  async readCustomer(context: ConsoleContext, id: string, signal?: AbortSignal) {
    const value = await this.partners.customersGet({ path: { customerid: id } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.customer(value);
  }

  async manageCustomer(context: ConsoleContext, change: CustomerChange, identity: string, signal?: AbortSignal) {
    const request = customerCommand(context, change.kind === 'create' ? undefined : change.customer.version, identity, signal);
    const value =
      change.kind === 'create'
        ? await this.partners.customersCreate({ body: customerBody('PartnerCustomersCreateInput', change.body) }, request)
        : change.kind === 'update'
          ? await this.partners.customersUpdate({ path: { customerid: change.customer.id }, body: customerBody('PartnerCustomersUpdateInput', change.body) }, request)
          : change.kind === 'enable'
            ? await this.partners.customersEnable({ path: { customerid: change.customer.id }, body: { reason: change.reason } }, request)
            : await this.partners.customersDisable({ path: { customerid: change.customer.id }, body: { reason: change.reason } }, request);
    return this.mapper.customer(value);
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

function customerCommand(context: ConsoleContext, version: number | undefined, identity: string, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(version === undefined ? {} : { expectedVersion: version }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}
