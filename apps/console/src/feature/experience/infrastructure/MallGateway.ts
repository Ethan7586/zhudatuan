import { createFetchOrganization, type OrganizationOperations } from '@shop/sdk/organization';
import type { ContractJsonObject, OperationBodyFor } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { deepFreeze } from '../../../shared/model/Immutable';
import { ScopeGateway } from '../../../shared/scope/ScopeGateway';
import type { MallCreateDraft, MallParent, MallRecord, MallUpdateDraft } from '../model/Mall';
import type { MallPort } from '../public';
import { MallRecordSchema } from './MallSchema';

export class MallGateway implements MallPort {
  private readonly client: OrganizationOperations;
  private readonly scopes: ScopeGateway;
  constructor(baseUrl: string) {
    this.client = createFetchOrganization(baseUrl);
    this.scopes = new ScopeGateway(baseUrl);
  }

  async parents(context: ConsoleContext, signal?: AbortSignal) {
    const rows = await this.scopes.read(context, signal);
    const items: MallParent[] = rows
      .filter((row) => ['platform', 'distributor', 'tenant', 'enterprise'].includes(row.kind))
      .map((row) => deepFreeze({ id: row.id, kind: row.kind, parentId: row.parent_id, name: row.name, timezone: row.timezone, version: row.version }));
    return deepFreeze({ items, count: items.length });
  }

  async create(context: ConsoleContext, draft: MallCreateDraft, identity: string, signal?: AbortSignal): Promise<MallRecord> {
    const body = createBody(draft);
    const value = await this.client.mallsCreate(
      { body },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity,
        expectedVersion: draft.parentVersion,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    return deepFreeze(MallRecordSchema.parse(value));
  }

  async read(context: ConsoleContext, mall: string, signal?: AbortSignal): Promise<MallRecord> {
    return deepFreeze(MallRecordSchema.parse(await this.client.mallsRead({ path: { mallid: mall } }, consoleRequest(context.scope, signal, context.session.accessVersion))));
  }

  async update(context: ConsoleContext, mall: string, version: number, draft: MallUpdateDraft, identity: string, signal?: AbortSignal): Promise<MallRecord> {
    const value = await this.client.mallsUpdate(
      { path: { mallid: mall }, body: updateBody(draft) },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity,
        expectedVersion: version,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    return deepFreeze(MallRecordSchema.parse(value));
  }
}

function createBody(draft: MallCreateDraft): OperationBodyFor<'OrganizationMallsCreateInput'> {
  const { parentVersion, ...body } = draft;
  void parentVersion;
  return body;
}

function updateBody(draft: MallUpdateDraft): OperationBodyFor<'OrganizationMallsUpdateInput'> & ContractJsonObject {
  const body = {
    ...(draft.name === undefined ? {} : { name: draft.name }),
    ...(draft.brandName === undefined ? {} : { brandName: draft.brandName }),
    ...(draft.domain === undefined ? {} : { domain: draft.domain }),
    ...(draft.ownerMembershipId === undefined ? {} : { ownerMembershipId: draft.ownerMembershipId }),
    ...(draft.timezone === undefined ? {} : { timezone: draft.timezone }),
    ...(draft.currency === undefined ? {} : { currency: draft.currency }),
    ...(draft.theme === undefined ? {} : { theme: draft.theme }),
    ...(draft.opening === undefined ? {} : { opening: draft.opening }),
    ...(draft.status === undefined ? {} : { status: draft.status }),
  } satisfies OperationBodyFor<'OrganizationMallsUpdateInput'>;
  return body;
}
