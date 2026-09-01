import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrganizationRepository } from '../../application/port/OrganizationRepository';
import { PgDirectoryInbox } from './PgDirectoryInbox';
import { PgDirectoryRepository } from './PgDirectoryRepository';
export class PgOrganizationRepository implements OrganizationRepository {
  private readonly directoryStore = new PgDirectoryRepository();
  private readonly inbox = new PgDirectoryInbox();
  constructor(private readonly transactions: PgTransactionAccess) {}
  async layers(context: ReadTransactionContext, input: Parameters<OrganizationRepository['layers']>[1]) {
    const result = await this.transactions
      .database(context)
      .query(
        `select child.id,child.kind,child.parent_id,child.name,child.timezone,child.status,child.version from organization.unitclosure visible join organization.organization child on child.id=visible.descendant_id where visible.ancestor_id=$1 and ($2::text is null or child.id>$2) order by child.id limit $3`,
        [input.scope, input.after, input.fetch]
      );
    return result.rows;
  }
  directories(context: ReadTransactionContext, scope: string, after: string | null, fetch: number) {
    return this.directoryStore.list(context, scope, after, fetch);
  }
  directory(context: ReadTransactionContext, id: string) {
    return this.directoryStore.require(context, id);
  }
  lockDirectory(context: WriteTransactionContext, id: string) {
    return this.directoryStore.lock(context, id);
  }
  webhookDirectory(context: ReadTransactionContext, id: string) {
    return this.directoryStore.requireWebhook(context, id);
  }
  saveDirectory(context: WriteTransactionContext, value: Parameters<OrganizationRepository['saveDirectory']>[1], expectedVersion: number) {
    return this.directoryStore.save(context, value, expectedVersion);
  }
  runs(context: ReadTransactionContext, connection: string, after: string | null, fetch: number) {
    return this.directoryStore.runs(context, connection, after, fetch);
  }
  createRun(context: WriteTransactionContext, connection: string, mode: Parameters<OrganizationRepository['createRun']>[2], key: string) {
    return this.directoryStore.createRun(context, connection, mode, key);
  }
  receive(context: WriteTransactionContext, input: Parameters<OrganizationRepository['receive']>[1]) {
    return this.inbox.receive(context, input);
  }
}
