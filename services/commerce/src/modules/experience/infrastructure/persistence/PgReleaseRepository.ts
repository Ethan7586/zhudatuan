import { randomUUID } from 'node:crypto';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ReleaseRepository } from '../../application/port/ReleaseRepository';
import { Release } from '../../domain/model/Release';
export class PgReleaseRepository implements ReleaseRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async publish(context: WriteTransactionContext, input: Parameters<ReleaseRepository['publish']>[1]) {
    const database = this.transactions.database(context);
    const release = Release.schedule({ id: `release:${randomUUID()}`, application: input.application, version: input.version, pool: input.pool, effectiveAt: new Date().toISOString(), actor: input.actor }).snapshot();
    await database.query(
      `insert into experience.release(id,application_id,version_id,pool_id,state,effective_at,retired_at,
      failed_at,failure_code,published_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [release.id, release.application, release.version, release.pool, release.state, release.effectiveAt, release.retiredAt, release.failedAt, release.failureCode, release.actor]
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
    if (!publication) throw new Error('EXPERIENCE_RELEASE_CREATE_FAILED');
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'experience.release.requested',
      aggregateType: 'experience',
      aggregate: input.application,
      scope: publication.mall_id,
      payload: Object.freeze({ release: release.id, application: input.application, version: input.version, hash: publication.configuration_hash, key: `experience/${publication.public_slug}/${publication.configuration_hash}.json` }),
      trace: input.trace,
    });
    return Object.freeze({
      id: release.id,
      application_id: release.application,
      version_id: release.version,
      pool_id: release.pool,
      state: release.state,
      effective_at: release.effectiveAt,
      retired_at: release.retiredAt,
      published_by: release.actor,
    });
  }
}
