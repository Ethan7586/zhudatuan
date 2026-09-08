import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrganizationRepository } from '../../application/port/OrganizationRepository';
import { PgDirectoryInbox } from './PgDirectoryInbox';
import { PgDirectoryRepository } from './PgDirectoryRepository';
import { DomainError } from '../../../../platform/error/DomainError';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import { mapMall, mapOrganization, mallColumns, type MallRow, type OrganizationRow } from './MallRecord';
export class PgOrganizationDirectoryStore {
  protected readonly directoryStore = new PgDirectoryRepository();
  protected readonly inbox = new PgDirectoryInbox();
  constructor(protected readonly transactions: PgTransactionAccess) {}

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
  createRun(context: WriteTransactionContext, connection: string, mode: Parameters<OrganizationRepository['createRun']>[2], key: string, preview = false) {
    return this.directoryStore.createRun(context, connection, mode, key, preview);
  }
  resumeRun(context: WriteTransactionContext, connection: string, run: string, key: string) {
    return this.directoryStore.resumeRun(context, connection, run, key);
  }
  cancelRun(context: WriteTransactionContext, connection: string, run: string) {
    return this.directoryStore.cancelRun(context, connection, run);
  }
  receive(context: WriteTransactionContext, input: Parameters<OrganizationRepository['receive']>[1]) {
    return this.inbox.receive(context, input);
  }

  protected async requireMall(context: ReadTransactionContext, mall: string, accessScope: string) {
    const result = await this.transactions.database(context).query<MallRow>(
      `select ${mallColumns} from organization.organization organization
       join organization.mall mall on mall.id=organization.id
       join organization.unitclosure visible on visible.ancestor_id=$2 and visible.descendant_id=organization.id
       where organization.id=$1 and organization.kind='mall'`,
      [mall, accessScope]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return mapMall(row);
  }

  protected async saveOwner(context: WriteTransactionContext, owner: Parameters<OrganizationRepository['createMall']>[1]['owner']) {
    await this.transactions.database(context).query(
      `insert into organization.membership(id,organization_id,source_membership_id,responsibility,status,version,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict(organization_id,source_membership_id,responsibility) do update set status='active',version=organization.membership.version+1,updated_at=excluded.updated_at`,
      [owner.id, owner.organizationid, owner.sourcemembershipid, owner.responsibility, owner.status, owner.version, owner.createdat, owner.updatedat]
    );
  }
}
