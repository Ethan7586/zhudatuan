import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ApplicationRepository } from '../../application/port/ApplicationRepository';
export class PgApplicationRepository implements ApplicationRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: OrganizationReadPort,
    private readonly catalog: ExperienceCatalogPort
  ) {}
  async create(context: WriteTransactionContext, input: Parameters<ApplicationRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const binding = await this.catalog.activeBinding(context, await this.organizations.activeMalls(context, input.accessScope));
    if (!binding) throw new DomainError('VALIDATION_FAILED', { field: 'mall' });
    await this.unique(database, binding.mall, input.name, input.identity);
    const id = `application:${randomUUID()}`;
    const version = `version:${randomUUID()}`;
    const configuration = initialConfiguration(id, input.name);
    await database.query(
      `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
      [id, binding.mall, input.identity.code, input.identity.publicSlug, input.name]
    );
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,'valid',$5,$6,clock_timestamp())`,
      [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), '创建商城初始化草稿', input.actor]
    );
    await database.query('insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)', [id, input.identity.publicSlug, binding.mall, binding.pool]);
    const result = await database.query('update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1 returning *', [id, version]);
    return required(result.rows[0], 'EXPERIENCE_APPLICATION_CREATE_FAILED');
  }
  async copy(context: WriteTransactionContext, input: Parameters<ApplicationRepository['copy']>[1]) {
    const database = this.transactions.database(context);
    const source = await database.query<{
      scope_id: string;
      configuration: unknown;
      validation_state: 'pending' | 'valid' | 'invalid';
      mall_id: string;
      pool_id: string;
    }>(
      `select application.scope_id,version.configuration,version.validation_state,binding.mall_id,binding.pool_id
      from experience.application application join experience.version version on version.id=application.head_version_id
      join lateral(select mall_id,pool_id from experience.binding where application_id=application.id order by domain limit 1) binding on true
      where application.id=$1`,
      [input.source]
    );
    const original = source.rows[0];
    if (!original) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.unique(database, original.scope_id, input.name, input.identity);
    const id = `application:${randomUUID()}`;
    const version = `version:${randomUUID()}`;
    const document = parseExperience(original.configuration);
    const configuration = serializeExperience({ ...document, application: id });
    await database.query(
      `insert into experience.application(id,scope_id,code,public_slug,name,status,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
      [id, original.scope_id, input.identity.code, input.identity.publicSlug, input.name]
    );
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,$5,$6,$7,clock_timestamp())`,
      [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), original.validation_state, input.reason, input.actor]
    );
    await database.query('insert into experience.binding(application_id,domain,mall_id,pool_id) values($1,$2,$3,$4)', [id, input.identity.publicSlug, original.mall_id, original.pool_id]);
    const result = await database.query('update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1 returning *', [id, version]);
    return Object.freeze({ ...required(result.rows[0], 'EXPERIENCE_APPLICATION_COPY_FAILED'), versionId: version });
  }
  async read(context: ReadTransactionContext, input: Parameters<ApplicationRepository['read']>[1]) {
    const database = this.transactions.database(context);
    const scopes = await this.organizations.descendants(context, input.scope);
    const result = await database.query(
      `select application.id,application.scope_id,application.code,application.public_slug,application.name,application.status,application.version,
      application.created_at,application.updated_at,head.id head_id,head.sequence head_sequence,head.schema_version head_schema_version,
      head.configuration head_configuration,head.validation_state head_validation_state,head.reason head_reason,head.created_at head_created_at,
      published.id published_id,published.sequence published_sequence,published.schema_version published_schema_version,
      published.configuration published_configuration,published.validation_state published_validation_state,published.reason published_reason,published.created_at published_created_at,
      binding.domain,binding.mall_id,binding.pool_id,coalesce(history.items,'[]'::jsonb) history
      from experience.application application left join experience.version head on head.id=application.head_version_id
      left join lateral(select version.id,version.application_id,version.sequence,version.schema_version,version.configuration,
        version.configuration_hash,version.validation_state,version.created_by,version.created_at,version.reason
        from experience.release release join experience.version version on version.id=release.version_id
        where release.application_id=application.id and release.state in('active','scheduled') order by case release.state when 'active' then 0 else 1 end,
        release.effective_at desc,release.id desc limit 1) published on true
      left join lateral(select domain,mall_id,pool_id from experience.binding where application_id=application.id order by domain limit 1) binding on true
      left join lateral(select jsonb_agg(jsonb_build_object('id',version.id,'sequence',version.sequence,'schemaVersion',version.schema_version,
        'configuration',version.configuration,'validationState',version.validation_state,'reason',version.reason,
        'createdAt',to_char(version.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'lifecycle',case when exists(select 1 from experience.release release where release.version_id=version.id and release.state in('active','scheduled'))
          then 'published' else 'draft' end) order by version.sequence desc) items from experience.version version
        where version.application_id=application.id) history on true
      where application.scope_id=any($1::text[]) and ($2='' or application.id=$2)
      and ($3::timestamptz is null or (application.updated_at,application.id)<($3::timestamptz,$4))
      order by application.updated_at desc,application.id desc limit $5`,
      [scopes, input.application, input.page.sort, input.page.id, input.page.fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
  }
  async update(context: WriteTransactionContext, input: Parameters<ApplicationRepository['update']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `update experience.application set name=coalesce($2,name),status=coalesce($3,status),version=version+1,updated_at=clock_timestamp()
      where id=$1 and ($4::bigint is null or version=$4) returning *`,
      [input.id, input.name, input.status, input.expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return Object.freeze({ ...result.rows[0] });
  }
  private async unique(database: ReturnType<PgTransactionAccess['database']>, scope: string, name: string, identity: Parameters<ApplicationRepository['create']>[1]['identity']): Promise<void> {
    const result = await database.query<{
      field: 'name' | 'code' | 'publicSlug';
    }>(
      `select case when name=$2 then 'name' when code=$3 then 'code' else 'publicSlug' end field from experience.application
      where scope_id=$1 and (name=$2 or code=$3 or public_slug=$4) order by case when name=$2 then 0 when code=$3 then 1 else 2 end limit 1`,
      [scope, name, identity.code, identity.publicSlug]
    );
    if (result.rows[0]) throw new DomainError('VALIDATION_FAILED', { field: result.rows[0].field });
  }
}
function initialConfiguration(application: string, name: string): string {
  return serializeExperience({ version: 2, application, pages: [{ id: `${application}:home`, path: 'home', blocks: [{ id: `${application}:home:hero`, component: 'hero', content: { title: name, subtitle: '企业福利，温暖抵达' } }] }] });
}
function required(row: Readonly<Record<string, unknown>> | undefined, code: string): Readonly<Record<string, unknown>> {
  if (!row) throw new Error(code);
  return Object.freeze({ ...row });
}
