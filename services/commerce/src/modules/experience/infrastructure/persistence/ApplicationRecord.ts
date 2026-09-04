import { parseExperience, type ExperienceDocument } from '@shop/contract';
import type { QueryResultRow } from 'pg';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import type { MallProvisionSnapshot } from '../../../organization/public';
import { Application, type ApplicationSnapshot } from '../../domain/model/Application';

export interface ApplicationSummaryRow extends QueryResultRow {
  readonly id: string;
  readonly mall_id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly is_primary: boolean;
  readonly head_version_id?: string | null;
  readonly version: unknown;
  readonly head_sequence: unknown;
  readonly head_theme: unknown;
  readonly binding_domains: unknown;
  readonly release_id: string | null;
  readonly release_version: string | null;
  readonly pool_id: string | null;
  readonly published_sequence: unknown;
  readonly validation_state: string | null;
  readonly publication_state: string | null;
  readonly content_hash: string | null;
  readonly configuration_hash: string | null;
  readonly object_key: string | null;
  readonly updated_at: Date | string;
  readonly created_at?: Date | string;
}

export interface ApplicationDetailRow extends ApplicationSummaryRow {
  readonly head: Readonly<Record<string, unknown>> | null;
  readonly published: Readonly<Record<string, unknown>> | null;
  readonly history: unknown;
}

export function applicationSummarySql(): string {
  return `select ${applicationSummaryColumns()} ${applicationSummaryFrom()}`;
}

export function applicationSummaryColumns(): string {
  return `application.id,application.mall_id,application.code,application.public_slug,application.name,application.status,application.is_primary,application.version,
    application.updated_at,head.sequence head_sequence,head.configuration->'theme' head_theme,
    coalesce(bindings.domains,'{}'::text[]) binding_domains,release.id release_id,release.version_id release_version,release.pool_id,
    publishedversion.sequence published_sequence,publishedversion.validation_state,publication.state publication_state,
    publication.content_hash,publishedversion.configuration_hash,publication.object_key`;
}

export function applicationSummaryFrom(): string {
  return `from experience.application application
    left join experience.version head on head.id=application.head_version_id
    left join lateral(select array_agg(lower(binding.domain)) domains from experience.binding binding where binding.application_id=application.id) bindings on true
    left join lateral(select item.id,item.version_id,item.pool_id from experience.release item
      where item.application_id=application.id and item.state='active' and item.effective_at<=clock_timestamp()
      order by item.effective_at desc,item.id desc limit 1) release on true
    left join experience.version publishedversion on publishedversion.id=release.version_id
    left join experience.publication publication on publication.release_id=release.id`;
}

export function applicationInitialConfiguration(application: string, mall: Pick<MallProvisionSnapshot, 'name' | 'theme'>): ExperienceDocument {
  const home = `${application}:home`;
  return parseExperience({
    version: 2,
    application,
    theme: mall.theme,
    navigation: [{ id: `${application}:navigation:home`, label: '首页', page: home }],
    assets: [mall.theme.logoObjectRef, mall.theme.faviconObjectRef].filter((value): value is string => value !== null),
    pages: [{ id: home, path: 'home', blocks: [{ id: `${application}:home:hero`, component: 'hero', content: { title: mall.name, subtitle: themeSubtitle(mall.theme.preset) } }] }],
  });
}

export function restoreApplication(
  row: Readonly<{
    id: string;
    mall_id: string;
    code: string;
    public_slug: string;
    name: string;
    status: ApplicationSnapshot['state'];
    is_primary: boolean;
    head_version_id: string | null;
    version: unknown;
    created_at: Date | string;
    updated_at: Date | string;
  }>
): Application {
  return Application.restore({
    id: row.id,
    mall: row.mall_id,
    code: row.code,
    publicSlug: row.public_slug,
    name: row.name,
    state: row.status,
    primary: row.is_primary,
    head: row.head_version_id,
    version: databaseInteger(row.version),
    createdAt: applicationIso(row.created_at),
    updatedAt: applicationIso(row.updated_at),
  });
}

function themeSubtitle(preset: MallProvisionSnapshot['theme']['preset']): string {
  if (preset === 'market') return '东方好物，精选策展';
  if (preset === 'governance') return '政企福利，稳健服务';
  return '企业福利，温暖抵达';
}

export function applicationOptionalInteger(value: unknown): number | null {
  return value === null || value === undefined ? null : databaseInteger(value);
}

export function requireApplicationPublication(value: string | null): string {
  if (!value) throw new DomainError('STOREFRONT_PUBLICATION_UNAVAILABLE');
  return value;
}

export function applicationIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error('EXPERIENCE_TIME_INVALID');
  return date.toISOString();
}

export function isApplicationRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function applicationConstraint(value: unknown): string | undefined {
  return value !== null && typeof value === 'object' && Reflect.get(value, 'code') === '23505' ? String(Reflect.get(value, 'constraint') ?? '') : undefined;
}
