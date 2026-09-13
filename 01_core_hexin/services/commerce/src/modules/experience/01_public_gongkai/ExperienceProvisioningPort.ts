import { createHash } from 'node:crypto';
import { serializeExperience } from '@shop/contract';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface MallExperienceProvisioning {
  readonly mall: string;
  readonly application: string;
  readonly version: string;
  readonly pool: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly actor: string;
}

export class ExperienceProvisioningPort {
  async allocateH5PublicSlug(database: OperationDatabase): Promise<string> {
    await database.query("select pg_advisory_xact_lock(hashtext('hbbtzn:h5-domain-sequence:v1'))");
    const result = await database.query<{ next_sequence: number }>(`select greatest(6,
      coalesce(max(substring(public_slug from '^h([0-9]+)$')::integer) + 1,6)) next_sequence
      from experience.application where public_slug ~ '^h[0-9]+$'`);
    return `h${result.rows[0]?.next_sequence ?? 6}`;
  }

  async publicSlugConflict(database: OperationDatabase, publicSlug: string, application: string): Promise<boolean> {
    const existing = await database.query(`select 1 from experience.application where public_slug=$1 or id=$2 limit 1`, [publicSlug, application]);
    return existing.rows[0] !== undefined;
  }

  async createMallApplication(database: OperationDatabase, input: MallExperienceProvisioning): Promise<void> {
    const configuration = serializeExperience({
      version: 2,
      application: input.application,
      pages: [{
        id: `${input.application}:home`,
        path: 'home',
        blocks: [{
          id: `${input.application}:home:identity`,
          component: 'richtext',
          content: { mallDisplayName: input.name },
        }],
      }],
    });
    await database.query(`insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
    [input.application, input.mall, input.code, input.publicSlug, input.name]);
    await database.query(`insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,'valid','mall provisioning default',$5,clock_timestamp())`,
    [input.version, input.application, configuration, createHash('sha256').update(configuration).digest('hex'), input.actor]);
    await database.query(`update experience.application set head_version_id=$2,updated_at=clock_timestamp() where id=$1`, [input.application, input.version]);
    await database.query(`insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)`,
    [input.application, input.publicSlug, input.mall, input.pool]);
  }
}

export const experienceProvisioningPort = new ExperienceProvisioningPort();
