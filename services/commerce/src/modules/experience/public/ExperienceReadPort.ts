import type { QueryResultRow } from 'pg';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { ReadSession, type ReadScope } from '../../../foundation/persistence/ReadSession';
import type { ReadDatabaseWorkload } from '../../../foundation/persistence/Workload';

export interface StorefrontBinding {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
}

export interface PublishedStorefront {
  readonly document: Readonly<Record<string, unknown>>;
  readonly version: string;
  readonly asOf: string;
}

export interface ExperienceReadPort {
  resolveHost(host: string): Promise<StorefrontBinding>;
  published(scope: ReadScope, binding: StorefrontBinding): Promise<PublishedStorefront>;
}

interface BindingRow extends QueryResultRow {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
}

export class PgExperienceReadPort implements ExperienceReadPort {
  private readonly reads: ReadSession;
  private readonly pool: DatabasePool;
  constructor(pool: DatabasePool, workload: ReadDatabaseWorkload = 'query') {
    this.pool = pool.workload(workload);
    this.reads = new ReadSession(pool, workload);
  }
  async resolveHost(host: string): Promise<StorefrontBinding> {
    const result = await this.pool.query<BindingRow>(
      `select application,mall,pool,release,version,tenant
      from experience.resolve_storefront_host($1)`,
      [host]
    );
    const row = result.rows[0];
    if (!row) throw new Error('STOREFRONT_HOST_NOT_PUBLISHED');
    return Object.freeze(row);
  }
  published(scope: ReadScope, binding: StorefrontBinding): Promise<PublishedStorefront> {
    return this.reads.run(scope, async (database) => {
      const result = await database.query<{ document: Readonly<Record<string, unknown>>; version: string; as_of: string }>(
        `select version.configuration document,version.id version,
        to_char(release.effective_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as_of
        from experience.release release join experience.version version on version.id=release.version_id
        where release.id=$1 and release.application_id=$2 and release.state='active'`,
        [binding.release, binding.application]
      );
      const row = result.rows[0];
      if (!row) throw new Error('STOREFRONT_RELEASE_NOT_PUBLISHED');
      return Object.freeze({ document: Object.freeze(row.document), version: row.version, asOf: row.as_of });
    });
  }
}

export const EXPERIENCE_READ_PORT = publicPort<ExperienceReadPort>('experience', 'read');
