import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ReleaseRepository } from '../../application/port/ReleaseRepository';
export class PgReleaseRepository implements ReleaseRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async publish(context: WriteTransactionContext, input: Parameters<ReleaseRepository['publish']>[1]) {
    const database = this.transactions.database(context);
    const release = `release:${randomUUID()}`;
    const result = await database.query(
      `insert into experience.release(id,application_id,version_id,pool_id,state,effective_at,published_by)
      values($1,$2,$3,$4,'scheduled',clock_timestamp(),$5) returning *`,
      [release, input.application, input.version, input.pool, input.actor]
    );
    const selected = await database.query<{
      mall_id: string;
      public_slug: string;
      configuration_hash: string;
    }>(
      `select application.mall_id,application.public_slug,version.configuration_hash
      from experience.application application join experience.version version on version.id=$2 where application.id=$1`,
      [input.application, input.version]
    );
    const publication = selected.rows[0];
    if (!publication || !result.rows[0]) throw new Error('EXPERIENCE_RELEASE_CREATE_FAILED');
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'experience.published',
      aggregateType: 'experience',
      aggregate: input.application,
      scope: publication.mall_id,
      payload: Object.freeze({ release, application: input.application, version: input.version, hash: publication.configuration_hash, key: `experience/${publication.public_slug}/${publication.configuration_hash}.json` }),
      trace: input.trace,
    });
    return Object.freeze({ ...result.rows[0] });
  }
}
