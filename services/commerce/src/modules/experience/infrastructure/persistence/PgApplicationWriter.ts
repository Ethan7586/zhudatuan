import { randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience, type ExperienceDocument } from '@shop/contract';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { MallProvisionPort } from '../../../organization/public';
import type { ApplicationRepository } from '../../application/port/ApplicationRepository';
import { Application, type ApplicationSnapshot, type ApplicationState } from '../../domain/model/Application';
import { ExperienceVersion } from '../../domain/model/ExperienceVersion';
import { applicationConstraint, applicationInitialConfiguration, restoreApplication } from './ApplicationRecord';
import type { PgApplicationReader } from './PgApplicationReader';

interface ApplicationRow extends Record<string, unknown> {
  readonly id: string;
  readonly mall_id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly status: ApplicationState;
  readonly is_primary: boolean;
  readonly head_version_id: string | null;
  readonly version: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export class PgApplicationWriter {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly malls: MallProvisionPort,
    private readonly catalog: ExperienceCatalogPort,
    private readonly reader: PgApplicationReader
  ) {}

  async create(context: WriteTransactionContext, input: Parameters<ApplicationRepository['create']>[1]) {
    const database = this.transactions.database(context);
    const mall = await this.malls.mall(context, input.mall, 1);
    if (!mall) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.catalog.provisionPool(context, { mall: mall.id, name: `${mall.name}商品池` });
    const identity = await this.identity(database, mall.code, mall.publicSlug);
    const applicationId = `application:${randomUUID()}`;
    const versionId = `version:${randomUUID()}`;
    const now = new Date().toISOString();
    const primary = !(await this.hasApplication(database, mall.id));
    const version = ExperienceVersion.create({
      id: versionId,
      application: applicationId,
      sequence: 1,
      document: applicationInitialConfiguration(applicationId, mall),
      reason: '创建商城初始化草稿',
      source: null,
      actor: input.actor,
      createdAt: now,
    });
    const application = Application.create({ id: applicationId, mall: mall.id, code: identity.code, publicSlug: identity.slug, name: mall.name, primary, head: versionId, createdAt: now, updatedAt: now });
    await this.insertApplication(database, application.snapshot());
    await this.insertVersion(database, version.snapshot());
    return this.reader.required(context, applicationId);
  }

  async copy(context: WriteTransactionContext, input: Parameters<ApplicationRepository['copy']>[1]) {
    const database = this.transactions.database(context);
    const source = await database.query<{ name: string; version_id: string; configuration: unknown }>(
      `select application.name,version.id version_id,
      version.configuration from experience.application application join experience.version version on version.id=application.head_version_id
      where application.id=$1 for key share of application,version`,
      [input.source]
    );
    const original = source.rows[0];
    if (!original) throw new DomainError('RESOURCE_NOT_FOUND');
    const mall = await this.malls.mall(context, input.targetMall, 1);
    if (!mall) throw new DomainError('RESOURCE_NOT_FOUND');
    await this.catalog.provisionPool(context, { mall: mall.id, name: `${mall.name}商品池` });
    const identity = await this.identity(database, mall.code, mall.publicSlug);
    const applicationId = `application:${randomUUID()}`;
    const versionId = `version:${randomUUID()}`;
    const now = new Date().toISOString();
    const document = copyDocument(parseExperience(original.configuration), applicationId);
    const version = ExperienceVersion.create({ id: versionId, application: applicationId, sequence: 1, document, reason: input.reason, source: null, actor: input.actor, createdAt: now });
    const application = Application.create({
      id: applicationId,
      mall: mall.id,
      code: identity.code,
      publicSlug: identity.slug,
      name: `${mall.name} · ${original.name}副本`.slice(0, 160),
      primary: !(await this.hasApplication(database, mall.id)),
      head: versionId,
      createdAt: now,
      updatedAt: now,
    });
    await this.insertApplication(database, application.snapshot());
    await this.insertVersion(database, version.snapshot());
    return Object.freeze({ ...(await this.reader.required(context, applicationId)), versionId });
  }

  async update(context: WriteTransactionContext, input: Parameters<ApplicationRepository['update']>[1]) {
    if (input.expectedVersion === null) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const database = this.transactions.database(context);
    const selected = await database.query<ApplicationRow>(
      `select id,mall_id,code,public_slug,name,status,is_primary,head_version_id,version,
      created_at,updated_at from experience.application where id=$1 and version=$2 for update`,
      [input.id, input.expectedVersion]
    );
    const row = selected.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    const state = input.status === null ? undefined : applicationState(input.status);
    const current = restoreApplication(row);
    const next = current.revise({ ...(input.name === null ? {} : { name: input.name }), ...(state === undefined ? {} : { state }) }, input.expectedVersion, new Date().toISOString()).snapshot();
    const changed = await database.query(
      `update experience.application set name=$2,status=$3,version=$4,updated_at=$5
      where id=$1 and version=$6 returning id`,
      [next.id, next.name, next.state, next.version, next.updatedAt, input.expectedVersion]
    );
    if (changed.rows.length !== 1) throw new DomainError('VERSION_CONFLICT');
    return this.reader.required(context, input.id);
  }

  private async identity(database: ReturnType<PgTransactionAccess['database']>, code: string, slug: string) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = randomUUID().replaceAll('-', '').slice(0, 6);
      const candidate = { code: `${code.slice(0, 24)}_${suffix.toUpperCase()}`, slug: `${slug.slice(0, 40)}-${suffix}` };
      const found = await database.query(`select 1 from experience.application where code=$1 or lower(public_slug)=lower($2) limit 1`, [candidate.code, candidate.slug]);
      if (!found.rows[0]) return candidate;
    }
    throw new DomainError('VERSION_CONFLICT');
  }

  private async hasApplication(database: ReturnType<PgTransactionAccess['database']>, mall: string): Promise<boolean> {
    return (await database.query(`select 1 from experience.application where mall_id=$1 limit 1`, [mall])).rows.length > 0;
  }

  private async insertApplication(database: ReturnType<PgTransactionAccess['database']>, value: ApplicationSnapshot): Promise<void> {
    try {
      await database.query(
        `insert into experience.application(id,mall_id,code,public_slug,name,status,is_primary,head_version_id,created_at,updated_at,version)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [value.id, value.mall, value.code, value.publicSlug, value.name, value.state, value.primary, value.head, value.createdAt, value.updatedAt, value.version]
      );
    } catch (cause) {
      if (['application_public_slug_unique', 'experience_application_code_unique'].includes(applicationConstraint(cause) ?? '')) {
        throw new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
      }
      throw cause;
    }
  }

  private async insertVersion(database: ReturnType<PgTransactionAccess['database']>, value: ReturnType<ExperienceVersion['snapshot']>): Promise<void> {
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,
      validation_issues,publish_evidence,reason,source_version_id,created_by,created_at,frozen_at)
      values($1,$2,$3,'2',$4::jsonb,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)`,
      [
        value.id,
        value.application,
        value.sequence,
        serializeExperience(value.document),
        value.hash,
        value.validation,
        JSON.stringify(value.issues),
        value.evidence === null ? null : JSON.stringify(value.evidence),
        value.reason,
        value.source,
        value.actor,
        value.createdAt,
        value.frozenAt,
      ]
    );
  }
}

function applicationState(value: string): ApplicationState {
  if (!['draft', 'active', 'disabled'].includes(value)) throw new DomainError('VALIDATION_FAILED', { field: 'status' });
  return value as ApplicationState;
}
function copyDocument(source: ExperienceDocument, application: string): ExperienceDocument {
  const remap = (value: string) => (value.startsWith(source.application) ? `${application}${value.slice(source.application.length)}` : value);
  return parseExperience({
    ...source,
    application,
    navigation: source.navigation.map((item) => ({ ...item, id: remap(item.id), page: remap(item.page) })),
    pages: source.pages.map((page) => ({
      ...page,
      id: remap(page.id),
      blocks: page.blocks.map((block) => ({ ...block, id: remap(block.id), ...(block.action === undefined ? {} : { action: { ...block.action, target: remap(block.action.target) } }) })),
    })),
  });
}
