import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { createHash } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperiencePublicationRepository, PublicationObject, PublicationTarget } from '../../application/port/ExperiencePublicationRepository';
import { Publication } from '../../domain/model/Publication';
import { restoreApplication } from './ApplicationRecord';
import { restoreRelease, type ApplicationOwnerRow, type PublicationRow, type ReleaseOwnerRow, type ReleaseRow } from './PublicationRecord';

export class PgExperiencePublicationRepository implements ExperiencePublicationRepository {
  constructor(private readonly transactions: PgTransactionAccess = new PgTransactionAccess()) {}

  async target(context: ReadTransactionContext, release: string): Promise<PublicationTarget | undefined> {
    const selected = await this.transactions.database(context).query<PublicationRow>(
      `select release.id release_id,release.application_id,release.version_id,release.pool_id,release.state,release.effective_at,
      version.configuration,version.configuration_hash from experience.release release join experience.version version on version.id=release.version_id
      where release.id=$1 and version.validation_state='valid' and version.frozen_at is not null`,
      [release]
    );
    const row = selected.rows[0];
    if (!row) return undefined;
    const configuration = parseExperience(row.configuration);
    if (createHash('sha256').update(serializeExperience(configuration)).digest('hex') !== row.configuration_hash) {
      throw new Error('EXPERIENCE_CONTENT_HASH_MISMATCH');
    }
    return Object.freeze({
      application: row.application_id,
      configuration,
      hash: row.configuration_hash,
      pool: row.pool_id,
      effectiveAt: row.effective_at,
      release: row.release_id,
      state: row.state,
      version: row.version_id,
    });
  }

  async activate(context: WriteTransactionContext, event: string, target: PublicationTarget, path: string, object: PublicationObject): Promise<Readonly<{ active: boolean; malls: readonly string[]; handles: readonly string[] }>> {
    const database = this.transactions.database(context);
    const runtime = new PgRuntimeWriter(database);
    const inbox = await runtime.claim('job:experiencepublish', event);
    if (!inbox) return Object.freeze({ active: false, malls: Object.freeze([]), handles: Object.freeze([]) });
    await database.query(`select pg_advisory_xact_lock(hashtextextended('experience:'||$1,0))`, [target.application]);
    const release = await database.query<ReleaseRow & { superseded: boolean }>(
      `select release.id,release.application_id,release.version_id,release.pool_id,release.state,release.effective_at,release.retired_at,
      release.failed_at,release.failure_code,release.published_by,exists(select 1 from experience.release current
      where current.application_id=release.application_id and current.state='active' and current.effective_at>release.effective_at) superseded
      from experience.release release where release.id=$1 for update`,
      [target.release]
    );
    const selected = release.rows[0];
    if (!selected) throw new Error('EXPERIENCE_RELEASE_NOT_FOUND');
    const now = new Date().toISOString();
    const currentRelease = restoreRelease(selected);
    if (!selected.superseded) {
      await database.query(`update experience.publication set state='retired' where application_id=$1 and state='active' and release_id<>$2`, [target.application, target.release]);
      await database.query(
        `update experience.release set state='retired',retired_at=$3,failed_at=null,failure_code=null
        where application_id=$1 and state='active' and id<>$2`,
        [target.application, target.release, now]
      );
    }
    const publication = (
      selected.superseded
        ? Publication.stage({
            id: `publication:${target.release}`,
            release: target.release,
            application: target.application,
            version: target.version,
            contentHash: target.hash,
            objectKey: path,
            objectRef: object.reference,
            objectHash: object.sha256,
            objectSize: object.size,
            stagedAt: now,
          })
        : Publication.stage({
            id: `publication:${target.release}`,
            release: target.release,
            application: target.application,
            version: target.version,
            contentHash: target.hash,
            objectKey: path,
            objectRef: object.reference,
            objectHash: object.sha256,
            objectSize: object.size,
            stagedAt: now,
          }).activate(now)
    ).snapshot();
    await database.query(
      `insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      on conflict(release_id) do update set object_ref=excluded.object_ref,object_hash=excluded.object_hash,object_size=excluded.object_size,
        state=excluded.state,published_at=excluded.published_at,failure_code=null`,
      [
        publication.id,
        publication.release,
        publication.application,
        publication.version,
        publication.contentHash,
        publication.objectKey,
        publication.objectRef,
        publication.objectHash,
        publication.objectSize,
        publication.state,
        publication.stagedAt,
        publication.publishedAt,
      ]
    );
    let malls: readonly string[] = Object.freeze([]);
    let handles: readonly string[] = Object.freeze([]);
    if (selected.superseded) {
      const retired = currentRelease.retire(now).snapshot();
      await database.query(`update experience.release set state=$2,retired_at=$3,failed_at=$4,failure_code=$5 where id=$1`, [retired.id, retired.state, retired.retiredAt, retired.failedAt, retired.failureCode]);
    } else {
      const application = await database.query<ApplicationOwnerRow>(
        `select id,mall_id,code,public_slug,name,status,is_primary,head_version_id,
        version,created_at,updated_at from experience.application where id=$1 for update`,
        [target.application]
      );
      const owner = application.rows[0];
      if (!owner) throw new Error('EXPERIENCE_APPLICATION_NOT_FOUND');
      malls = Object.freeze([owner.mall_id]);
      handles = Object.freeze([owner.public_slug]);
      const activated = currentRelease.activate().snapshot();
      await database.query(`update experience.release set state=$2,retired_at=$3,failed_at=$4,failure_code=$5 where id=$1`, [activated.id, activated.state, activated.retiredAt, activated.failedAt, activated.failureCode]);
      const current = restoreApplication(owner);
      const active = current.revise({ state: 'active' }, current.snapshot().version, now);
      if (active !== current) {
        const next = active.snapshot();
        await database.query(`update experience.application set status=$2,version=$3,updated_at=$4 where id=$1 and version=$5`, [next.id, next.state, next.version, next.updatedAt, current.snapshot().version]);
      }
      await runtime.append({
        id: `event:${target.release}:activated`,
        type: 'experience.release.activated',
        aggregateType: 'experience',
        aggregate: target.application,
        scope: owner.mall_id,
        trace: context.trace,
        payload: { release: target.release, application: target.application, version: target.version, hash: target.hash, key: path },
      });
    }
    return Object.freeze({ active: !selected.superseded, malls, handles });
  }

  async fail(context: WriteTransactionContext, event: string, target: PublicationTarget, code: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`select pg_advisory_xact_lock(hashtextextended('experience:'||$1,0))`, [target.application]);
    const selected = await database.query<ReleaseOwnerRow>(
      `select release.id,release.application_id,release.version_id,release.pool_id,release.state,
      release.effective_at,release.retired_at,release.failed_at,release.failure_code,release.published_by,application.mall_id
      from experience.release release join experience.application application on application.id=release.application_id
      where release.id=$1 for update of release`,
      [target.release]
    );
    const row = selected.rows[0];
    if (!row || row.state === 'active' || row.state === 'retired') return;
    const now = new Date().toISOString();
    const failed = restoreRelease(row).fail(code, now).snapshot();
    if (row.state === 'failed' && row.failure_code === code) return;
    await database.query(`update experience.release set state=$2,failed_at=$3,failure_code=$4,retired_at=null where id=$1`, [failed.id, failed.state, failed.failedAt, failed.failureCode]);
    await new PgRuntimeWriter(database).append({
      id: `event:${target.release}:failed:${event}`,
      type: 'experience.release.failed',
      aggregateType: 'experience',
      aggregate: target.application,
      scope: row.mall_id,
      trace: context.trace,
      payload: { release: target.release, application: target.application, version: target.version, code },
    });
  }

  async complete(context: WriteTransactionContext, event: string): Promise<void> {
    if (!(await new PgRuntimeWriter(this.transactions.database(context)).completeInbox('job:experiencepublish', event))) {
      throw new Error('EXPERIENCE_INBOX_LEASE_LOST');
    }
  }
}
