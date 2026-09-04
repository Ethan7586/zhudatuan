import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchOrganization, type OrganizationOperations } from '@shop/sdk/organization';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { DirectoryCommand } from '../model/SyncRun';
import type { DirectoryPort } from '../public';
import { DirectoryMapper } from './DirectoryMapper';

export class DirectoryGateway implements DirectoryPort {
  private readonly client: OrganizationOperations;
  private readonly mapper = new DirectoryMapper();
  constructor(baseUrl: string) {
    this.client = createFetchOrganization(baseUrl);
  }
  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.directories(await this.client.directoriesRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }
  async runs(context: ConsoleContext, directory: string, cursor?: string, signal?: AbortSignal) {
    return this.mapper.runs(
      await this.client.directoriesSyncrunsRead({ path: { directoryid: directory }, query: { limit: 20, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion))
    );
  }
  async synchronize(context: ConsoleContext, command: DirectoryCommand, signal?: AbortSignal) {
    const body = command.action === 'start' ? ({ action: command.action, mode: command.mode } as const) : ({ action: command.action, run: command.run } as const);
    return this.mapper.receipt(
      await this.client.directoriesSync(
        { path: { directoryid: command.directory }, body },
        consoleCommand(context.scope, {
          accessVersion: context.session.accessVersion,
          proof: command.proof,
          idempotencyKey: command.identity,
          ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
          ...(signal === undefined ? {} : { signal }),
        })
      )
    );
  }
  createIdentity(): string {
    return createIdempotencyKey();
  }
}
