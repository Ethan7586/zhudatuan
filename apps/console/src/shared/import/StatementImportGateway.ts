import { createFetchChannelConnectionsRead } from '@shop/sdk/channel';
import { createFetchFinanceStatementimportsCreate, createFetchFinanceStatementimportsRead } from '@shop/sdk/finance';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../api/RequestContext';
import { ImportUploadGateway, type UploadedImport } from './ImportUploadGateway';
import { mapStatementImportCreated, mapStatementImportRead, statementImportBody, statementProviderOptions, type StatementImportMetadata } from './StatementImport';

export class StatementImportGateway {
  private readonly connections;
  private readonly createImport;
  private readonly readImport;
  private readonly uploads;

  constructor(baseUrl: string) {
    this.connections = createFetchChannelConnectionsRead(baseUrl);
    this.createImport = createFetchFinanceStatementimportsCreate(baseUrl);
    this.readImport = createFetchFinanceStatementimportsRead(baseUrl);
    this.uploads = new ImportUploadGateway(baseUrl);
  }

  async providers(context: ConsoleContext, signal?: AbortSignal) {
    const value = await this.connections({ query: { limit: 50 } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return statementProviderOptions(value);
  }

  async create(context: ConsoleContext, file: File, metadata: StatementImportMetadata, identity: string, progress?: (processed: number) => void, signal?: AbortSignal) {
    const uploaded = await this.uploads.upload(context, file, signal, progress, identity);
    return this.createUploaded(context, uploaded, metadata, identity, signal);
  }

  async createUploaded(context: ConsoleContext, upload: UploadedImport, metadata: StatementImportMetadata, identity: string, signal?: AbortSignal) {
    const value = await this.createImport(
      { body: statementImportBody(upload, metadata) },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    return mapStatementImportCreated(value);
  }

  async read(context: ConsoleContext, id: string, signal?: AbortSignal) {
    const value = await this.readImport({ path: { importid: id } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return mapStatementImportRead(value);
  }
}
