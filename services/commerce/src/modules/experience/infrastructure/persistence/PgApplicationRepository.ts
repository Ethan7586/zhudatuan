import { createHash, randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { ExperienceOrganizationPort, OrganizationReadPort } from '../../../organization/public';
import type { ApplicationDetail, ApplicationSummary } from '../../application/model/ApplicationSummary';
import type { ApplicationRepository } from '../../application/port/ApplicationRepository';
import type { StorefrontConfig } from '../../application/port/StorefrontConfig';
import { EntryPolicy } from '../../domain/policy/EntryPolicy';
import { StorefrontAddress } from '../../domain/value/StorefrontAddress';
import { applicationConstraint, applicationInitialConfiguration, applicationIso, applicationOptionalInteger, applicationSummaryColumns, applicationSummaryFrom, applicationSummarySql, isApplicationRecord, requireApplicationPublication, type ApplicationDetailRow, type ApplicationSummaryRow } from './ApplicationRecord';

export class PgApplicationRepository implements ApplicationRepository {
  private readonly policy = new EntryPolicy();

  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: OrganizationReadPort,
    private readonly organizationWriter: ExperienceOrganizationPort,
    private readonly catalog: ExperienceCatalogPort,
    private readonly storefront: StorefrontConfig
  ) {}

  async create(context: WriteTransactionContext, input: Parameters<ApplicationRepository['create']>[1]): Promise<ApplicationSummary> {
    const database = this.transactions.database(context);
    await this.unique(database, input.identity.publicSlug);
    const mall = await this.organizationWriter.createMall(context, { parent: input.accessScope, name: input.name });
    await this.catalog.provisionPool(context, { mall, name: `${input.name}商品池` });
    const id = `application:${randomUUID()}`;
    const version = `version:${randomUUID()}`;
    const configuration = applicationInitialConfiguration(id, input.name);
    await this.insertApplication(database, { id, mall, code: input.identity.code, publicSlug: input.identity.publicSlug, name: input.name });
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,'valid',$5,$6,clock_timestamp())`,
      [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), '创建商城初始化草稿', input.actor]
    );
    await database.query(`update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1`, [id, version]);
    return this.requiredSummary(context, id);
  }

  async copy(context: WriteTransactionContext, input: Parameters<ApplicationRepository['copy']>[1]): Promise<ApplicationSummary & { readonly versionId: string }> {
    const database = this.transactions.database(context);
    await this.unique(database, input.identity.publicSlug);
    const source = await database.query<{ mall_id: string; configuration: unknown; validation_state: 'pending' | 'valid' | 'invalid' }>(
      `select application.mall_id,version.configuration,version.validation_state
      from experience.application application join experience.version version on version.id=application.head_version_id
      where application.id=$1 for key share of application,version`,
      [input.source]
    );
    const original = source.rows[0];
    if (!original) throw new DomainError('RESOURCE_NOT_FOUND');
    const sourceBinding = await this.catalog.activeBinding(context, [original.mall_id]);
    if (!sourceBinding) throw new DomainError('VALIDATION_FAILED', { field: 'pool' });
    const mall = await this.organizationWriter.copyMall(context, { source: original.mall_id, name: input.name });
    await this.catalog.provisionPool(context, { mall, name: `${input.name}商品池`, source: sourceBinding.pool });
    const id = `application:${randomUUID()}`;
    const version = `version:${randomUUID()}`;
    const document = parseExperience(original.configuration);
    const configuration = serializeExperience({ ...document, application: id });
    await this.insertApplication(database, { id, mall, code: input.identity.code, publicSlug: input.identity.publicSlug, name: input.name });
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,reason,created_by,created_at)
      values($1,$2,1,'2',$3::jsonb,$4,$5,$6,$7,clock_timestamp())`,
      [version, id, configuration, createHash('sha256').update(configuration).digest('hex'), original.validation_state, input.reason, input.actor]
    );
    await database.query(`update experience.application set head_version_id=$2,version=1,updated_at=clock_timestamp() where id=$1`, [id, version]);
    return Object.freeze({ ...(await this.requiredSummary(context, id)), versionId: version });
  }

  async readSummaries(context: ReadTransactionContext, input: Parameters<ApplicationRepository['readSummaries']>[1]): Promise<readonly ApplicationSummary[]> {
    const scopes = await this.organizations.descendants(context, input.scope);
    const rows = await this.transactions.database(context).query<ApplicationSummaryRow>(
      `${applicationSummarySql()}
      where application.mall_id=any($1::text[]) and ($2='' or application.id=$2)
      and ($3::timestamptz is null or (application.updated_at,application.id)<($3::timestamptz,$4))
      order by application.updated_at desc,application.id desc limit $5`,
      [scopes, input.application, input.page.sort, input.page.id, input.page.fetch]
    );
    return Object.freeze(rows.rows.map((row) => this.mapSummary(row, context.trace)));
  }

  async detail(context: ReadTransactionContext, input: Parameters<ApplicationRepository['detail']>[1]): Promise<ApplicationDetail> {
    const scopes = await this.organizations.descendants(context, input.scope);
    const selected = await this.transactions.database(context).query<ApplicationDetailRow>(
      `select ${applicationSummaryColumns()},
      case when head.id is null then null else jsonb_build_object('id',head.id,'application_id',head.application_id,'sequence',head.sequence,
        'schema_version',head.schema_version,'configuration',head.configuration,'configuration_hash',head.configuration_hash,
        'validation_state',head.validation_state,'reason',head.reason,'created_by',head.created_by,
        'created_at',to_char(head.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end head,
      case when publishedversion.id is null then null else jsonb_build_object('id',publishedversion.id,'application_id',publishedversion.application_id,
        'sequence',publishedversion.sequence,'schema_version',publishedversion.schema_version,'configuration',publishedversion.configuration,
        'configuration_hash',publishedversion.configuration_hash,'validation_state',publishedversion.validation_state,'reason',publishedversion.reason,
        'created_by',publishedversion.created_by,'created_at',to_char(publishedversion.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end published,
      coalesce(history.items,'[]'::jsonb) history
      ${applicationSummaryFrom()}
      left join lateral(select jsonb_agg(item.value order by item.sequence desc) items from(
        select version.sequence,jsonb_build_object('id',version.id,'sequence',version.sequence,'schemaVersion',version.schema_version,
          'validationState',version.validation_state,'reason',version.reason,
          'createdAt',to_char(version.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'lifecycle',case when exists(select 1 from experience.release item where item.version_id=version.id and item.state in('active','scheduled')) then 'published' else 'draft' end) value
        from experience.version version where version.application_id=application.id order by version.sequence desc limit 20) item) history on true
      where application.id=$1 and application.mall_id=any($2::text[])`,
      [input.application, scopes]
    );
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    const history = Array.isArray(row.history) ? row.history.filter(isApplicationRecord).map((item) => Object.freeze({ ...item })) : [];
    return Object.freeze({ ...this.mapSummary(row, context.trace), head: row.head ? Object.freeze({ ...row.head }) : null, published: row.published ? Object.freeze({ ...row.published }) : null, history: Object.freeze(history) });
  }

  async update(context: WriteTransactionContext, input: Parameters<ApplicationRepository['update']>[1]): Promise<ApplicationSummary> {
    const result = await this.transactions.database(context).query<{ id: string }>(
      `update experience.application set name=coalesce($2,name),status=coalesce($3,status),version=version+1,updated_at=clock_timestamp()
      where id=$1 and ($4::bigint is null or version=$4) returning id`,
      [input.id, input.name, input.status, input.expectedVersion]
    );
    if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
    return this.requiredSummary(context, input.id);
  }

  private async requiredSummary(context: ReadTransactionContext, application: string): Promise<ApplicationSummary> {
    const selected = await this.transactions.database(context).query<ApplicationSummaryRow>(`${applicationSummarySql()} where application.id=$1`, [application]);
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return this.mapSummary(row, context.trace);
  }

  private mapSummary(row: ApplicationSummaryRow, requestId: string): ApplicationSummary {
    const address = StorefrontAddress.from(row.public_slug, this.storefront);
    const state = this.policy.decide({
      applicationStatus: row.status,
      release: row.release_id,
      version: row.release_version,
      validationState: row.validation_state,
      publicationState: row.publication_state,
      contentHash: row.content_hash,
      configurationHash: row.configuration_hash,
      objectKey: row.object_key,
      pool: row.pool_id,
    });
    const entry =
      state === 'ready'
        ? Object.freeze({ handle: address.handle, url: address.url, state, releaseId: requireApplicationPublication(row.release_id), releaseVersion: requireApplicationPublication(row.release_version), contentHash: requireApplicationPublication(row.content_hash) })
        : Object.freeze({ handle: address.handle, url: address.url, state, ...(state === 'invalid' ? { requestId } : {}) });
    return Object.freeze({
      id: row.id,
      mallId: row.mall_id,
      code: row.code,
      publicSlug: row.public_slug,
      name: row.name,
      status: row.status,
      version: databaseInteger(row.version),
      headSequence: applicationOptionalInteger(row.head_sequence),
      publishedSequence: applicationOptionalInteger(row.published_sequence),
      entry,
      updatedAt: applicationIso(row.updated_at),
    });
  }

  private async unique(database: ReturnType<PgTransactionAccess['database']>, publicSlug: string): Promise<void> {
    const result = await database.query(`select 1 from experience.application where lower(public_slug)=lower($1) limit 1`, [publicSlug]);
    if (result.rows[0]) throw new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
  }

  private async insertApplication(database: ReturnType<PgTransactionAccess['database']>, input: Readonly<{ id: string; mall: string; code: string; publicSlug: string; name: string }>): Promise<void> {
    try {
      await database.query(
        `insert into experience.application(id,mall_id,code,public_slug,name,status,created_at,updated_at,version)
        values($1,$2,$3,$4,$5,'draft',clock_timestamp(),clock_timestamp(),0)`,
        [input.id, input.mall, input.code, input.publicSlug, input.name]
      );
    } catch (cause) {
      if (applicationConstraint(cause) === 'application_public_slug_unique') throw new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
      throw cause;
    }
  }
}
