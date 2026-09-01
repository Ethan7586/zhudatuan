import { createHash, randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { VersionRepository } from '../../application/port/VersionRepository';
export class PgVersionRepository implements VersionRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async save(context: WriteTransactionContext, input: Parameters<VersionRepository['save']>[1]) {
    const database = this.transactions.database(context);
    const application = await database.query<{
      id: string;
    }>('select id from experience.application where id=$1 and version=$2 for update', [input.application, input.expectedVersion]);
    if (!application.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const canonical = serializeExperience(input.document);
    const version = `version:${randomUUID()}`;
    const result = await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      select $1,$2,coalesce(max(sequence),0)+1,'2',$3::jsonb,$4,'pending',$5,$6,clock_timestamp()
      from experience.version where application_id=$2 returning *`,
      [version, input.application, canonical, createHash('sha256').update(canonical).digest('hex'), input.reason, input.actor]
    );
    await database.query('update experience.application set head_version_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1', [input.application, version]);
    return required(result.rows[0], 'EXPERIENCE_VERSION_SAVE_FAILED');
  }
  async validate(context: WriteTransactionContext, versionId: string) {
    const database = this.transactions.database(context);
    const loaded = await database.query<{
      configuration: unknown;
      application_id: string;
    }>('select configuration,application_id from experience.version where id=$1 for update', [versionId]);
    const version = loaded.rows[0];
    if (!version) throw new DomainError('RESOURCE_NOT_FOUND');
    const valid = validConfiguration(version.configuration, version.application_id);
    const result = await database.query('update experience.version set validation_state=$2 where id=$1 returning id,application_id,validation_state', [versionId, valid ? 'valid' : 'invalid']);
    return required(result.rows[0], 'EXPERIENCE_VERSION_VALIDATE_FAILED');
  }
  async publishable(context: WriteTransactionContext, version: string, expectedVersion: number) {
    const database = this.transactions.database(context);
    const loaded = await database.query<{
      application_id: string;
      validation_state: string;
      configuration: unknown;
      pool_id: string | null;
    }>(
      `select version.application_id,version.validation_state,version.configuration,
      (select pool_id from experience.binding where application_id=version.application_id order by domain limit 1) pool_id
      from experience.version version join experience.application application on application.id=version.application_id
      where version.id=$1 and application.version=$2 for update of version,application`,
      [version, expectedVersion]
    );
    const row = loaded.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ application: row.application_id, validation: row.validation_state, configuration: row.configuration, pool: row.pool_id });
  }
  async restore(context: WriteTransactionContext, input: Parameters<VersionRepository['restore']>[1]) {
    const database = this.transactions.database(context);
    const source = await database.query<{
      application_id: string;
    }>('select application_id from experience.version where id=$1', [input.version]);
    const applicationId = source.rows[0]?.application_id;
    if (!applicationId) throw new DomainError('RESOURCE_NOT_FOUND');
    const application = await database.query<{
      id: string;
    }>('select id from experience.application where id=$1 and version=$2 for update', [applicationId, input.expectedVersion]);
    if (!application.rows[0]) throw new DomainError('VERSION_CONFLICT');
    const version = `version:${randomUUID()}`;
    const result = await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      select $1,source.application_id,(select coalesce(max(sequence),0)+1 from experience.version where application_id=source.application_id),source.schema_version,
        source.configuration,source.configuration_hash,'valid',$2,$3,clock_timestamp() from experience.version source where source.id=$4 returning *`,
      [version, input.reason, input.actor, input.version]
    );
    await database.query('update experience.application set head_version_id=$2,version=version+1,updated_at=clock_timestamp() where id=$1', [applicationId, version]);
    return required(result.rows[0], 'EXPERIENCE_VERSION_RESTORE_FAILED');
  }
}
function validConfiguration(value: unknown, application: string): boolean {
  try {
    return parseExperience(value).application === application;
  } catch {
    return false;
  }
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: string): Readonly<Record<string, unknown>> {
  if (!row) throw new Error(code);
  return Object.freeze({ ...row });
}
