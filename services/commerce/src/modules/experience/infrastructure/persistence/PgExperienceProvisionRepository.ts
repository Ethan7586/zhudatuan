import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceCatalogPort } from '../../../catalog/public';
import type { ExperienceProvisionRepository } from '../../application/port/ExperienceProvisionRepository';
import { parseExperience, serializeExperience } from '@shop/contract';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import { Application, type ApplicationSnapshot } from '../../domain/model/Application';
import { ExperienceVersion, type ExperienceVersionSnapshot } from '../../domain/model/ExperienceVersion';
import { applicationInitialConfiguration, restoreApplication } from './ApplicationRecord';

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

export class PgExperienceProvisionRepository implements ExperienceProvisionRepository {
  constructor(
    private readonly catalog: ExperienceCatalogPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}

  async provision(context: WriteTransactionContext, input: Parameters<ExperienceProvisionRepository['provision']>[1]) {
    const database = this.transactions.database(context);
    const runtime = new PgRuntimeWriter(database);
    const event = await runtime.claim('job:experienceprovision', input.event);
    if (!event) return 'replayed' as const;
    if (!['organization.mall.created', 'organization.mall.updated'].includes(event.type) || event.aggregate !== input.mall.id) throw new Error('EXPERIENCE_MALL_EVENT_MISMATCH');
    await database.query(`select pg_advisory_xact_lock(hashtextextended('experience:provision:'||$1,0))`, [input.mall.id]);
    const existing = await database.query<ApplicationRow>(
      `select id,mall_id,code,public_slug,name,status,is_primary,head_version_id,version,created_at,updated_at
      from experience.application where mall_id=$1 and is_primary for update`,
      [input.mall.id]
    );
    if (existing.rows[0]) {
      await this.synchronize(context, existing.rows[0], input.mall, input.actor);
      await this.complete(runtime, input.event);
      return 'synchronized' as const;
    }
    await this.catalog.provisionPool(context, { mall: input.mall.id, name: `${input.mall.name}商品池` });
    const application = `application:${input.mall.id}`;
    const version = `${application}:version:1`;
    const now = new Date().toISOString();
    const initial = ExperienceVersion.create({ id: version, application, sequence: 1, document: applicationInitialConfiguration(application, input.mall), reason: '商城创建后初始化草稿', source: null, actor: input.actor, createdAt: now });
    const owner = Application.create({ id: application, mall: input.mall.id, code: input.mall.code, publicSlug: input.mall.publicSlug, name: input.mall.name, primary: true, head: version, createdAt: now, updatedAt: now });
    await this.insertApplication(database, owner.snapshot());
    await this.insertVersion(database, initial.snapshot());
    await this.complete(runtime, input.event);
    return 'created' as const;
  }

  private async synchronize(context: WriteTransactionContext, row: ApplicationRow, mall: Parameters<ExperienceProvisionRepository['provision']>[1]['mall'], actor: string): Promise<void> {
    const database = this.transactions.database(context);
    let application = restoreApplication(row);
    const revised = application.revise({ name: mall.name, state: mall.status }, application.snapshot().version, new Date().toISOString());
    if (revised !== application) {
      await this.saveApplication(database, application.snapshot().version, revised.snapshot());
      application = revised;
    }
    if (!row.head_version_id) return;
    const current = await database.query<{ configuration: unknown; sequence: unknown }>(`select configuration,sequence from experience.version where id=$1 and application_id=$2 for key share`, [row.head_version_id, row.id]);
    const head = current.rows[0];
    if (!head) throw new Error('EXPERIENCE_PROVISION_HEAD_MISSING');
    const document = parseExperience(head.configuration);
    if (sameTheme(document.theme, mall.theme)) return;
    const now = new Date().toISOString();
    const version = `${row.id}:version:${databaseInteger(head.sequence) + 1}`;
    const synchronized = ExperienceVersion.create({
      id: version,
      application: row.id,
      sequence: databaseInteger(head.sequence) + 1,
      document: parseExperience({ ...document, theme: mall.theme }),
      reason: '商城主题资料同步',
      source: row.head_version_id,
      actor,
      createdAt: now,
    });
    await this.insertVersion(database, synchronized.snapshot());
    const advanced = application.advance(version, application.snapshot().version, now);
    await this.saveApplication(database, application.snapshot().version, advanced.snapshot());
  }

  private async insertApplication(database: ReturnType<PgTransactionAccess['database']>, value: ApplicationSnapshot): Promise<void> {
    await database.query(
      `insert into experience.application(id,mall_id,code,public_slug,name,status,is_primary,head_version_id,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [value.id, value.mall, value.code, value.publicSlug, value.name, value.state, value.primary, value.head, value.createdAt, value.updatedAt, value.version]
    );
  }

  private async insertVersion(database: ReturnType<PgTransactionAccess['database']>, value: ExperienceVersionSnapshot): Promise<void> {
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

  private async saveApplication(database: ReturnType<PgTransactionAccess['database']>, expected: number, value: ApplicationSnapshot): Promise<void> {
    const saved = await database.query(
      `update experience.application set name=$2,status=$3,head_version_id=$4,version=$5,updated_at=$6
      where id=$1 and version=$7 returning id`,
      [value.id, value.name, value.state, value.head, value.version, value.updatedAt, expected]
    );
    if (saved.rows.length !== 1) throw new Error('EXPERIENCE_PROVISION_VERSION_CONFLICT');
  }

  private async complete(runtime: PgRuntimeWriter, event: string): Promise<void> {
    if (!(await runtime.completeInbox('job:experienceprovision', event))) throw new Error('EXPERIENCE_PROVISION_INBOX_LEASE_LOST');
  }
}

function sameTheme(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right);
}
