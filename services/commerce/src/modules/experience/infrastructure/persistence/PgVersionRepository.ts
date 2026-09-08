import { randomUUID } from 'node:crypto';
import { parseExperience, serializeExperience } from '@shop/contract';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { VersionRepository } from '../../application/port/VersionRepository';
import { ExperienceVersion, type ExperienceVersionSnapshot, type ValidationState } from '../../domain/model/ExperienceVersion';
import type { ComponentIssue } from '../../domain/value/ComponentTree';
import { PublishEvidence } from '../../domain/value/PublishEvidence';
import { applicationIso, restoreApplication } from './ApplicationRecord';

interface VersionRow extends Record<string, unknown> {
  readonly id: string;
  readonly application_id: string;
  readonly sequence: unknown;
  readonly configuration: unknown;
  readonly configuration_hash: string;
  readonly validation_state: ValidationState;
  readonly validation_issues: unknown;
  readonly publish_evidence: unknown;
  readonly reason: string;
  readonly source_version_id: string | null;
  readonly created_by: string;
  readonly created_at: Date | string;
  readonly frozen_at: Date | string | null;
}

interface ApplicationRow extends Record<string, unknown> {
  readonly id: string;
  readonly mall_id: string;
  readonly code: string;
  readonly public_slug: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly is_primary: boolean;
  readonly head_version_id: string | null;
  readonly version: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export class PgVersionRepository implements VersionRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly catalog: ExperienceCatalogPort
  ) {}

  async save(context: WriteTransactionContext, input: Parameters<VersionRepository['save']>[1]) {
    const database = this.transactions.database(context);
    const application = await this.application(database, input.application, input.expectedVersion);
    const sequence = await this.nextSequence(database, input.application);
    const now = new Date().toISOString();
    const version = ExperienceVersion.create({ id: `version:${randomUUID()}`, application: input.application, sequence, document: input.document, reason: input.reason, source: null, actor: input.actor, createdAt: now });
    await this.insert(database, version.snapshot());
    await this.advance(database, application, version.snapshot().id, now);
    return output(version.snapshot());
  }

  async candidate(context: WriteTransactionContext, version: string, expectedVersion?: number) {
    const database = this.transactions.database(context);
    const loaded = await database.query<VersionRow & { mall_id: string; application_version: unknown }>(
      `${versionProjection('version')},application.mall_id,application.version application_version
       from experience.version version join experience.application application on application.id=version.application_id
       where version.id=$1 and ($2::bigint is null or application.version=$2) for update of version,application`,
      [version, expectedVersion ?? null]
    );
    const row = loaded.rows[0];
    if (!row) throw new DomainError(expectedVersion === undefined ? 'RESOURCE_NOT_FOUND' : 'VERSION_CONFLICT');
    const binding = await this.catalog.activeBinding(context, [row.mall_id]);
    const snapshot = restoreVersion(row).snapshot();
    return Object.freeze({
      id: snapshot.id,
      application: snapshot.application,
      mall: row.mall_id,
      validation: snapshot.validation,
      issues: snapshot.issues,
      configuration: snapshot.document,
      pool: binding?.pool ?? null,
      frozenAt: snapshot.frozenAt,
    });
  }

  async recordValidation(context: WriteTransactionContext, version: string, evidence: PublishEvidence) {
    const database = this.transactions.database(context);
    const loaded = await database.query<VersionRow>(`${versionProjection('version')} from experience.version version where version.id=$1 for update`, [version]);
    const current = loaded.rows[0];
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    const validated = restoreVersion(current).validate(evidence).snapshot();
    if (validated.frozenAt === null) {
      await database.query(`update experience.version set validation_state=$2,validation_issues=$3::jsonb,publish_evidence=$4::jsonb where id=$1 and frozen_at is null`, [
        version,
        validated.validation,
        JSON.stringify(validated.issues),
        JSON.stringify(validated.evidence),
      ]);
    }
    return Object.freeze({ id: validated.id, application_id: validated.application, validation_state: validated.validation, issues: validated.issues });
  }

  async freeze(context: WriteTransactionContext, version: string): Promise<void> {
    const database = this.transactions.database(context);
    const loaded = await database.query<VersionRow>(`${versionProjection('version')} from experience.version version where version.id=$1 for update`, [version]);
    const current = loaded.rows[0];
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    const frozen = restoreVersion(current).freeze(new Date().toISOString()).snapshot();
    await database.query(`update experience.version set frozen_at=$2 where id=$1 and frozen_at is null`, [version, frozen.frozenAt]);
  }

  async restore(context: WriteTransactionContext, input: Parameters<VersionRepository['restore']>[1]) {
    const database = this.transactions.database(context);
    const sourceResult = await database.query<VersionRow>(`${versionProjection('version')} from experience.version version where version.id=$1`, [input.version]);
    const source = sourceResult.rows[0];
    if (!source) throw new DomainError('RESOURCE_NOT_FOUND');
    const original = restoreVersion(source).snapshot();
    const application = await this.application(database, original.application, input.expectedVersion);
    const now = new Date().toISOString();
    const restored = ExperienceVersion.create({
      id: `version:${randomUUID()}`,
      application: original.application,
      sequence: await this.nextSequence(database, original.application),
      document: original.document,
      reason: input.reason,
      source: original.id,
      actor: input.actor,
      createdAt: now,
    });
    await this.insert(database, restored.snapshot());
    await this.advance(database, application, restored.snapshot().id, now);
    return output(restored.snapshot());
  }

  private async application(database: ReturnType<PgTransactionAccess['database']>, id: string, expected: number) {
    const selected = await database.query<ApplicationRow>(
      `select id,mall_id,code,public_slug,name,status,is_primary,head_version_id,version,created_at,updated_at
      from experience.application where id=$1 and version=$2 for update`,
      [id, expected]
    );
    const row = selected.rows[0];
    if (!row) throw new DomainError('VERSION_CONFLICT');
    return restoreApplication(row);
  }

  private async nextSequence(database: ReturnType<PgTransactionAccess['database']>, application: string): Promise<number> {
    const result = await database.query<{ sequence: unknown }>(`select coalesce(max(sequence),0) sequence from experience.version where application_id=$1`, [application]);
    return databaseInteger(result.rows[0]?.sequence ?? 0) + 1;
  }

  private async insert(database: ReturnType<PgTransactionAccess['database']>, snapshot: ExperienceVersionSnapshot): Promise<void> {
    await database.query(
      `insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,
      validation_state,validation_issues,publish_evidence,reason,source_version_id,created_by,created_at,frozen_at)
      values($1,$2,$3,'2',$4::jsonb,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)`,
      [
        snapshot.id,
        snapshot.application,
        snapshot.sequence,
        serializeExperience(snapshot.document),
        snapshot.hash,
        snapshot.validation,
        JSON.stringify(snapshot.issues),
        snapshot.evidence === null ? null : JSON.stringify(snapshot.evidence),
        snapshot.reason,
        snapshot.source,
        snapshot.actor,
        snapshot.createdAt,
        snapshot.frozenAt,
      ]
    );
  }

  private async advance(database: ReturnType<PgTransactionAccess['database']>, current: ReturnType<typeof restoreApplication>, head: string, now: string): Promise<void> {
    const snapshot = current.snapshot();
    const next = current.advance(head, snapshot.version, now).snapshot();
    const updated = await database.query(
      `update experience.application set head_version_id=$2,version=$3,updated_at=$4
      where id=$1 and version=$5 returning id`,
      [next.id, next.head, next.version, next.updatedAt, snapshot.version]
    );
    if (updated.rows.length !== 1) throw new DomainError('VERSION_CONFLICT');
  }
}

function versionProjection(alias: string): string {
  return `select ${alias}.id,${alias}.application_id,${alias}.sequence,${alias}.configuration,${alias}.configuration_hash,
    ${alias}.validation_state,${alias}.validation_issues,${alias}.reason,${alias}.source_version_id,${alias}.created_by,
    ${alias}.created_at,${alias}.frozen_at,${alias}.publish_evidence`;
}
function restoreVersion(row: VersionRow): ExperienceVersion {
  return ExperienceVersion.restore({
    id: row.id,
    application: row.application_id,
    sequence: databaseInteger(row.sequence),
    document: parseExperience(row.configuration),
    hash: row.configuration_hash,
    validation: row.validation_state,
    issues: issues(row.validation_issues),
    evidence: row.publish_evidence === null ? null : PublishEvidence.restore(row.publish_evidence).snapshot(),
    reason: row.reason,
    source: row.source_version_id,
    actor: row.created_by,
    createdAt: applicationIso(row.created_at),
    frozenAt: row.frozen_at === null ? null : applicationIso(row.frozen_at),
  });
}
function issues(value: unknown): readonly ComponentIssue[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value
      .filter((item): item is ComponentIssue => item !== null && typeof item === 'object' && typeof Reflect.get(item, 'code') === 'string' && typeof Reflect.get(item, 'path') === 'string' && typeof Reflect.get(item, 'message') === 'string')
      .map((item) => Object.freeze({ code: item.code, path: item.path, message: item.message }))
  );
}
function output(snapshot: ExperienceVersionSnapshot): Readonly<Record<string, unknown>> {
  return Object.freeze({
    id: snapshot.id,
    application_id: snapshot.application,
    sequence: snapshot.sequence,
    schema_version: '2',
    configuration: snapshot.document,
    configuration_hash: snapshot.hash,
    validation_state: snapshot.validation,
    validation_issues: snapshot.issues,
    reason: snapshot.reason,
    created_by: snapshot.actor,
    created_at: snapshot.createdAt,
  });
}
