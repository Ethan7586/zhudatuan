import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash } from 'node:crypto';
import { operationLifecycle, type OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DirectoryRepository } from '../port/DirectoryRepository';
import type { DirectoryProviderRegistry } from '../service/DirectoryProviderRegistry';
import type { DirectoryInboxPort } from '../port/DirectoryInboxPort';

export class ReceiveDirectoryEvent {
  constructor(
    private readonly repository: DirectoryRepository,
    private readonly inbox: DirectoryInboxPort,
    private readonly providers: DirectoryProviderRegistry,
    private readonly kms: KmsClient
  ) {}
  action(): OperationLifecycle<Prepared, Awaited<ReturnType<DirectoryRepository['requireWebhook']>>> {
    return operationLifecycle<Prepared, Awaited<ReturnType<DirectoryRepository['requireWebhook']>>>({
      load: async (request, database) => {
        const connectionid = request.input.path.directoryid;
        if (!connectionid || request.input.rawBody.length > 1_048_576) throw new DomainError('VALIDATION_FAILED');
        return this.repository.requireWebhook(database, connectionid);
      },
      prepare: async (request, connection) => {
        if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
        const event = await this.providers.require(connection.providertype).verify(connection, request.input.rawBody, request.input.headers, request.input.query);
        const envelope = await this.kms.encrypt('providerconfig', 'organization/directory', event.payload, { connection: connection.id, event: event.eventid });
        return Object.freeze({ connection: connection.id, eventid: event.eventid, version: event.version, bodyhash: createHash('sha256').update(event.payload).digest('hex'), payload: envelope.ciphertext });
      },
      execute: async (_request, database, prepared) => {
        await this.inbox.receive(database, prepared);
        return { status: 204, headers: { 'cache-control': 'no-store' } };
      },
    });
  }
}
interface Prepared {
  readonly connection: string;
  readonly eventid: string;
  readonly version: number;
  readonly bodyhash: string;
  readonly payload: string;
}
