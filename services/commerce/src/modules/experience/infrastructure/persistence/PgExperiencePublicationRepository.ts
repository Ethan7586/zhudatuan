import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperiencePublicationRepository, PublicationObject, PublicationTarget } from '../../application/port/ExperiencePublicationRepository';

interface PublicationRow {
  readonly application_id: string;
  readonly configuration: unknown;
  readonly configuration_hash: string;
  readonly effective_at: string;
  readonly release_id: string;
  readonly state: string;
  readonly version_id: string;
}

export class PgExperiencePublicationRepository implements ExperiencePublicationRepository {
  constructor(private readonly transactions: PgTransactionAccess = new PgTransactionAccess()) {}

  async target(context: ReadTransactionContext, release: string): Promise<PublicationTarget | undefined> {
    const selected = await this.transactions.database(context).query<PublicationRow>(
      `select release.id release_id,release.application_id,release.version_id,release.state,release.effective_at,
      version.configuration,version.configuration_hash from experience.release release join experience.version version on version.id=release.version_id
      where release.id=$1`,
      [release]
    );
    const row = selected.rows[0];
    return row
      ? Object.freeze({
          application: row.application_id,
          configuration: row.configuration,
          hash: row.configuration_hash,
          effectiveAt: row.effective_at,
          release: row.release_id,
          state: row.state,
          version: row.version_id,
        })
      : undefined;
  }

  async activate(context: WriteTransactionContext, event: string, target: PublicationTarget, path: string, object: PublicationObject): Promise<Readonly<{ active: boolean; malls: readonly string[] }>> {
    const database = this.transactions.database(context);
    const runtime = new PgRuntimeWriter(database);
    const inbox = await runtime.claim('job:experiencepublish', event);
    if (!inbox) return Object.freeze({ active: false, malls: Object.freeze([]) });
    await database.query(`select pg_advisory_xact_lock(hashtextextended('experience:'||$1,0))`, [target.application]);
    const release = await database.query<{ superseded: boolean }>(
      `select exists(select 1 from experience.release current
      where current.application_id=release.application_id and current.state='active' and current.effective_at>release.effective_at) superseded
      from experience.release release where release.id=$1 for update`,
      [target.release]
    );
    const selected = release.rows[0];
    if (!selected) throw new Error('EXPERIENCE_RELEASE_NOT_FOUND');
    if (!selected.superseded) {
      await database.query(`update experience.publication set state='retired' where application_id=$1 and state='active' and release_id<>$2`, [target.application, target.release]);
      await database.query(`update experience.release set state='retired',retired_at=clock_timestamp() where application_id=$1 and state='active' and id<>$2`, [target.application, target.release]);
    }
    await database.query(
      `insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
      values('publication:'||$1,$1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),case when $9='active' then clock_timestamp() end)
      on conflict(release_id) do update set object_ref=excluded.object_ref,object_hash=excluded.object_hash,object_size=excluded.object_size,
        state=excluded.state,published_at=excluded.published_at`,
      [target.release, target.application, target.version, target.hash, path, object.reference, object.sha256, object.size, selected.superseded ? 'staged' : 'active']
    );
    let malls: readonly string[] = Object.freeze([]);
    if (selected.superseded) {
      await database.query(`update experience.release set state='retired',retired_at=clock_timestamp() where id=$1`, [target.release]);
    } else {
      const bindings = await database.query<{ mall_id: string }>(`select mall_id from experience.binding where application_id=$1 order by mall_id`, [target.application]);
      malls = Object.freeze(bindings.rows.map(({ mall_id }) => mall_id));
      await database.query(`update experience.release set state='active',retired_at=null where id=$1 and state in('scheduled','active')`, [target.release]);
      await database.query(
        `update experience.application set head_version_id=$2,status='active',version=version+case when head_version_id is distinct from $2 then 1 else 0 end,
        updated_at=clock_timestamp() where id=$1`,
        [target.application, target.version]
      );
    }
    if (!(await runtime.completeInbox('job:experiencepublish', event))) throw new Error('EXPERIENCE_INBOX_LEASE_LOST');
    return Object.freeze({ active: !selected.superseded, malls });
  }

  async complete(context: WriteTransactionContext, event: string): Promise<void> {
    if (!(await new PgRuntimeWriter(this.transactions.database(context)).completeInbox('job:experiencepublish', event))) {
      throw new Error('EXPERIENCE_INBOX_LEASE_LOST');
    }
  }
}
