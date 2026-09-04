import { createFetchAccess, type AccessOperations } from '@shop/sdk/access';
import { createIdempotencyKey } from '@shop/sdk/context';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import { createActionRequest } from '../../../../shared/security/ActionRequest';
import { accessEnvelope, ownershipPreviewEnvelope, type AccessChange, type OwnerChange } from '../model/Access';
import type { AccessPort } from '../public';
import { AccessMapper } from './AccessMapper';

export class AccessGateway implements AccessPort {
  private readonly operations: AccessOperations;
  private readonly mapper = new AccessMapper();

  constructor(baseUrl: string) {
    this.operations = createFetchAccess(baseUrl);
  }

  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.operations.centerRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.page(value);
  }

  async readOwnership(context: ConsoleContext, signal?: AbortSignal) {
    return this.mapper.ownership(await this.operations.ownershipRead({}, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async previewOwnership(context: ConsoleContext, change: OwnerChange, identity: string, signal?: AbortSignal) {
    const envelope = ownershipPreviewEnvelope(change);
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: envelope.expectedVersion,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    if (change.action === 'create') return this.mapper.ownershipPreview(change, await this.operations.ownershipTransfersPreview(envelope.input as Parameters<AccessOperations['ownershipTransfersPreview']>[0], request));
    if (change.action === 'accept') return this.mapper.ownershipPreview(change, await this.operations.ownershipTransfersAcceptPreview(envelope.input as Parameters<AccessOperations['ownershipTransfersAcceptPreview']>[0], request));
    return this.mapper.ownershipPreview(change, await this.operations.ownershipTransfersCancelPreview(envelope.input as Parameters<AccessOperations['ownershipTransfersCancelPreview']>[0], request));
  }

  prepare(change: AccessChange, makerMembership: string, scope: string) {
    const envelope = accessEnvelope(change);
    return createActionRequest(envelope.operation, envelope.input, envelope.expectedVersion, makerMembership, scope);
  }

  async execute(context: ConsoleContext, change: AccessChange, proof: string, identity: string, signal?: AbortSignal) {
    const envelope = accessEnvelope(change);
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: envelope.expectedVersion,
      proof,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    if (change.kind === 'role') return this.mapper.role(await this.operations.rolesManage(envelope.input as Parameters<AccessOperations['rolesManage']>[0], request));
    if (change.kind === 'override') return this.mapper.override(await this.operations.overridesManage(envelope.input as Parameters<AccessOperations['overridesManage']>[0], request));
    if (change.kind === 'scope') return this.mapper.scope(await this.operations.scopesManage(envelope.input as Parameters<AccessOperations['scopesManage']>[0], request));
    if (change.action === 'create') return this.mapper.owner(change, await this.operations.ownershipTransfersCreate(envelope.input as Parameters<AccessOperations['ownershipTransfersCreate']>[0], request));
    if (change.action === 'accept') return this.mapper.owner(change, await this.operations.ownershipTransfersAccept(envelope.input as Parameters<AccessOperations['ownershipTransfersAccept']>[0], request));
    return this.mapper.owner(change, await this.operations.ownershipTransfersCancel(envelope.input as Parameters<AccessOperations['ownershipTransfersCancel']>[0], request));
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
}
