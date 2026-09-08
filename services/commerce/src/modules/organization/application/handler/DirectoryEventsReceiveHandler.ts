import { createHash } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CommitContext, FinalizeContext, HandlerContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';
import type { OrganizationRepository } from '../port/OrganizationRepository';
import type { DirectoryProviderRegistry } from '../service/DirectoryProviderRegistry';

interface PreparedEvent {
  readonly connection: string;
  readonly eventid: string;
  readonly version: number;
  readonly bodyhash: string;
  readonly payload: string;
}
export class DirectoryEventsReceiveHandler implements DurableOperationHandler<'organization.directoryevents.receive', PreparedEvent, undefined, 'write', DirectoryConnection> {
  readonly operation = 'organization.directoryevents.receive' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly providers: DirectoryProviderRegistry,
    private readonly kms: KmsClient
  ) {}
  load(input: OperationInputFor<'organization.directoryevents.receive'>, context: HandlerContext<'organization.directoryevents.receive'>): Promise<DirectoryConnection> {
    if (context.rawBody.length > 1_048_576) throw new DomainError('VALIDATION_FAILED');
    return this.organizations.webhookDirectory(context.transaction, input.path.directoryid);
  }
  async prepare(input: OperationInputFor<'organization.directoryevents.receive'>, context: PrepareContext<'organization.directoryevents.receive'>, connection: DirectoryConnection): Promise<PreparedEvent> {
    if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
    const event = await this.providers.require(connection.providertype).verify(connection, context.rawBody, context.headers, (input.query ?? {}) as Readonly<Record<string, string | readonly string[]>>);
    const envelope = await this.kms.encrypt('providerconfig', 'organization/directory', event.payload, { connection: connection.id, event: event.eventid });
    return Object.freeze({ connection: connection.id, eventid: event.eventid, version: event.version, bodyhash: createHash('sha256').update(event.payload).digest('hex'), payload: envelope.ciphertext });
  }
  async commit(_input: OperationInputFor<'organization.directoryevents.receive'>, prepared: PreparedEvent, context: CommitContext<'organization.directoryevents.receive'>) {
    await this.organizations.receive(context.transaction, prepared);
    return Object.freeze({ checkpoint: undefined, response: { status: 204, body: undefined, headers: { 'cache-control': 'no-store' } } });
  }
  finalize(
    _input: OperationInputFor<'organization.directoryevents.receive'>,
    _checkpoint: undefined,
    _context: FinalizeContext<'organization.directoryevents.receive'>
  ): Promise<OperationReply<OperationOutputFor<'organization.directoryevents.receive'>>> {
    return Promise.resolve({ status: 204, body: undefined, headers: { 'cache-control': 'no-store' } });
  }
}
