import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { parseExperienceTheme } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { MallProvisionPort, MallProvisionSnapshot, OrganizationReadPort } from '../../../organization/public';
import type { ApplicationDetail, ApplicationSummary } from '../../application/model/ApplicationSummary';
import type { ApplicationRepository } from '../../application/port/ApplicationRepository';
import type { StorefrontConfig } from '../../application/port/StorefrontConfig';
import { EntryPolicy } from '../../domain/policy/EntryPolicy';
import { StorefrontAddress } from '../../domain/value/StorefrontAddress';
import {
  applicationIso,
  applicationOptionalInteger,
  applicationSummaryColumns,
  applicationSummaryFrom,
  applicationSummarySql,
  isApplicationRecord,
  requireApplicationPublication,
  type ApplicationDetailRow,
  type ApplicationSummaryRow,
} from './ApplicationRecord';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';

export class PgApplicationReader {
  private readonly policy = new EntryPolicy();
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly organizations: OrganizationReadPort,
    private readonly malls: MallProvisionPort,
    private readonly storefront: StorefrontConfig
  ) {}

  async readSummaries(context: ReadTransactionContext, input: Parameters<ApplicationRepository['readSummaries']>[1]): Promise<readonly ApplicationSummary[]> {
    const scopes = await this.organizations.descendants(context, input.scope);
    const rows = await this.transactions.database(context).query<ApplicationSummaryRow>(
      `${applicationSummarySql()}
      where application.mall_id=any($1::text[]) and ($2='' or application.id=$2)
      and ($3::timestamptz is null or (application.updated_at,application.id)<($3::timestamptz,$4))
      order by application.updated_at desc,application.id desc limit $5`,
      [scopes, input.application, input.page.sort, input.page.id, input.page.fetch]
    );
    const profiles = await this.profiles(context, rows.rows);
    return Object.freeze(rows.rows.map((row) => this.map(row, context.trace, profiles.get(row.mall_id))));
  }

  async detail(context: ReadTransactionContext, input: Parameters<ApplicationRepository['detail']>[1]): Promise<ApplicationDetail> {
    const scopes = await this.organizations.descendants(context, input.scope);
    const selected = await this.transactions.database(context).query<ApplicationDetailRow>(
      `select ${applicationSummaryColumns()},
      case when head.id is null then null else jsonb_build_object('id',head.id,'application_id',head.application_id,'sequence',head.sequence,
        'schema_version',head.schema_version,'configuration',head.configuration,'configuration_hash',head.configuration_hash,
        'validation_state',head.validation_state,'validation_issues',head.validation_issues,'reason',head.reason,'created_by',head.created_by,
        'created_at',to_char(head.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end head,
      case when publishedversion.id is null then null else jsonb_build_object('id',publishedversion.id,'application_id',publishedversion.application_id,
        'sequence',publishedversion.sequence,'schema_version',publishedversion.schema_version,'configuration',publishedversion.configuration,
        'configuration_hash',publishedversion.configuration_hash,'validation_state',publishedversion.validation_state,
        'validation_issues',publishedversion.validation_issues,'reason',publishedversion.reason,'created_by',publishedversion.created_by,
        'created_at',to_char(publishedversion.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end published,
      coalesce(history.items,'[]'::jsonb) history ${applicationSummaryFrom()}
      left join lateral(select jsonb_agg(item.value order by item.sequence desc) items from(
        select version.sequence,jsonb_build_object('id',version.id,'sequence',version.sequence,'schemaVersion',version.schema_version,
          'validationState',version.validation_state,'reason',version.reason,
          'createdAt',to_char(version.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'lifecycle',case when version.frozen_at is not null then 'published' else 'draft' end) value
        from experience.version version where version.application_id=application.id order by version.sequence desc limit 20) item) history on true
      where application.id=$1 and application.mall_id=any($2::text[])`,
      [input.application, scopes]
    );
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    const profile = (await this.malls.malls(context, [row.mall_id]))[0];
    const history = Array.isArray(row.history) ? row.history.filter(isApplicationRecord).map((item) => Object.freeze({ ...item })) : [];
    return Object.freeze({ ...this.map(row, context.trace, profile), head: row.head ? Object.freeze({ ...row.head }) : null, published: row.published ? Object.freeze({ ...row.published }) : null, history: Object.freeze(history) });
  }

  async required(context: ReadTransactionContext, application: string): Promise<ApplicationSummary> {
    const selected = await this.transactions.database(context).query<ApplicationSummaryRow>(`${applicationSummarySql()} where application.id=$1`, [application]);
    const row = selected.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    const profile = (await this.malls.malls(context, [row.mall_id]))[0];
    return this.map(row, context.trace, profile);
  }

  private map(row: ApplicationSummaryRow, requestId: string, profile: MallProvisionSnapshot | undefined): ApplicationSummary {
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
        ? Object.freeze({
            handle: address.handle,
            url: address.url,
            state,
            releaseId: requireApplicationPublication(row.release_id),
            releaseVersion: requireApplicationPublication(row.release_version),
            contentHash: requireApplicationPublication(row.content_hash),
          })
        : Object.freeze({ handle: address.handle, url: address.url, state, ...(state === 'invalid' ? { requestId } : {}) });
    return Object.freeze({
      id: row.id,
      mallId: row.mall_id,
      mallName: profile?.name ?? null,
      brandName: profile?.brandName ?? null,
      code: row.code,
      publicSlug: row.public_slug,
      name: row.name,
      status: row.status,
      version: databaseInteger(row.version),
      headSequence: applicationOptionalInteger(row.head_sequence),
      publishedSequence: applicationOptionalInteger(row.published_sequence),
      theme: row.head_theme === null || row.head_theme === undefined ? (profile?.theme ?? null) : parseExperienceTheme(row.head_theme),
      domain: domainHealth(profile, entry.state, address.url),
      entry,
      updatedAt: applicationIso(row.updated_at),
    });
  }

  private async profiles(context: ReadTransactionContext, rows: readonly ApplicationSummaryRow[]): Promise<ReadonlyMap<string, MallProvisionSnapshot>> {
    const profiles = await this.malls.malls(
      context,
      rows.map((row) => row.mall_id)
    );
    return new Map(profiles.map((profile) => [profile.id, profile]));
  }
}

function domainHealth(profile: MallProvisionSnapshot | undefined, entry: ApplicationSummary['entry']['state'], platformAddress: string): ApplicationSummary['domain'] {
  if (!profile) return Object.freeze({ mode: 'unknown', address: null, state: 'unknown' });
  const mode = profile.domain.mode;
  const address = mode === 'custom' ? profile.domain.customDomain : platformAddress;
  if (entry === 'disabled') return Object.freeze({ mode, address, state: 'disabled' });
  if (entry === 'invalid') return Object.freeze({ mode, address, state: 'invalid' });
  return Object.freeze({ mode, address, state: entry === 'ready' ? 'ready' : 'pending' });
}
