import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CurrentDirectorySubject, DirectoryApplyKind, DirectoryDeparture, StagedSubject } from '../../application/port/DirectoryRepository';
import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';
import { DirectoryMembership } from '../../domain/model/DirectoryMembership';
import { DirectorySubject } from '../../domain/model/DirectorySubject';
import { writeDirectoryOrganization } from './DirectoryOrganizationWriter';

export class PgDirectorySubjectStore {
  private readonly transactions = new PgTransactionAccess();

  async current(context: ReadTransactionContext, connection: string, hashes: readonly Buffer[]): Promise<ReadonlyMap<string, CurrentDirectorySubject>> {
    const database = this.transactions.database(context);
    if (hashes.length === 0) return new Map();
    const result = await database.query<{ hash: string; id: string; status: string; sourceversion: number; missingcount: number; membership: string | null }>(
      `select encode(subject.subject_hash,'hex') hash,subject.id,subject.status,subject.source_version sourceversion,subject.missing_count missingcount,
        (select membership.membership_id from organization.directorymembership membership where membership.subject_id=subject.id and membership.membership_id is not null order by membership.version desc limit 1) membership
       from organization.directorysubject subject where subject.connection_id=$1 and subject.subject_hash=any($2::bytea[])`,
      [connection, hashes]
    );
    return new Map(result.rows.map((row) => [row.hash, Object.freeze(row)]));
  }

  async apply(context: WriteTransactionContext, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void> {
    const database = this.transactions.database(context);
    if (subject.type === 'department') await writeDirectoryOrganization(database, connection, subject);
    const stored = kind === 'conflict' ? 'conflict' : subject.status;
    const entity = new DirectorySubject({ id: subject.id, connectionid: connection.id, hash: subject.hash, type: subject.type, status: stored, attributes: subject.attributes, sourceversion: subject.sourceversion, version: 0 });
    await database.query(
      `insert into organization.directorysubject(id,connection_id,subject_hash,type,status,attributes_ciphertext,source_version,missing_count,version)
      values($1,$2,$3,$4,$5,$6,$7,0,0) on conflict(connection_id,subject_hash) do update set status=excluded.status,
      attributes_ciphertext=excluded.attributes_ciphertext,source_version=excluded.source_version,missing_count=0,version=organization.directorysubject.version+1,
      last_seen_at=clock_timestamp() where organization.directorysubject.source_version<=excluded.source_version`,
      [entity.id, entity.connectionid, entity.hash, entity.type, entity.status, entity.attributes, entity.sourceversion]
    );
    if (subject.type !== 'user') return;
    await database.query(
      `update organization.directorymembership set status='inactive',version=version+1
      where connection_id=$1 and subject_id=$2 and organization_id<>$3 and status='active'`,
      [connection.id, subject.id, subject.organization]
    );
    const membership = new DirectoryMembership({
      id: subject.id,
      connectionid: connection.id,
      subjectid: subject.id,
      organizationid: subject.organization,
      membershipid: subject.membership,
      status: kind === 'conflict' ? 'conflict' : subject.membership === null ? 'pending' : subject.status === 'active' ? 'active' : 'inactive',
      effectiveat: new Date().toISOString(),
      expiresat: null,
      sourceversion: subject.sourceversion,
      version: 0,
    });
    await database.query(
      `insert into organization.directorymembership(id,connection_id,subject_id,organization_id,membership_id,status,effective_at,source_version,version)
      values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,0) on conflict(connection_id,subject_id,organization_id) do update set
      membership_id=coalesce(organization.directorymembership.membership_id,excluded.membership_id),status=excluded.status,
      source_version=excluded.source_version,version=organization.directorymembership.version+1
      where organization.directorymembership.source_version<=excluded.source_version`,
      [membership.id, membership.connectionid, membership.subjectid, membership.organizationid, membership.membershipid, membership.status, membership.sourceversion]
    );
  }

  async departures(context: ReadTransactionContext, connection: string): Promise<readonly DirectoryDeparture[]> {
    const result = await this.transactions.database(context).query<DirectoryDeparture>(
      `select subject.id subject,membership.membership_id membership,membership.organization_id organization
      from organization.directorysubject subject join organization.directorymembership membership on membership.subject_id=subject.id
      where subject.connection_id=$1 and subject.type='user' and subject.missing_count>=2 and subject.status='active'
        and membership.membership_id is not null and membership.status='active' order by subject.id limit 1000`,
      [connection]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }

  async freeze(context: WriteTransactionContext, connection: string, subject: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`update organization.directorysubject set status='inactive',version=version+1 where id=$1 and connection_id=$2 and status='active'`, [subject, connection]);
    await database.query(`update organization.directorymembership set status='inactive',version=version+1 where subject_id=$1 and connection_id=$2 and status='active'`, [subject, connection]);
  }
}
