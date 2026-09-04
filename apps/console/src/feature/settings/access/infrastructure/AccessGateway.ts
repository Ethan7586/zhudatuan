import { createFetchAccess, type AccessOperations } from '@shop/sdk/access';
import { createIdempotencyKey } from '@shop/sdk/context';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import { createActionRequest } from '../../../../shared/security/ActionRequest';
import { accessEnvelope, type AccessChange } from '../model/Access';
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
    return this.mapper.owner(await this.operations.ownersTransfer(envelope.input as Parameters<AccessOperations['ownersTransfer']>[0], request));
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
}
