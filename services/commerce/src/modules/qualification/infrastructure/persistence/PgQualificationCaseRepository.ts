import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { QualificationCaseRecord, QualificationCaseRepository } from '../../application/port/QualificationCaseRepository';
import type { EvidenceSnapshot } from '../../domain/model/Evidence';
import type { QualificationCaseSnapshot, QualificationState, QualificationTarget, QualificationTargetKind } from '../../domain/model/QualificationCase';

interface CaseRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly title: string;
  readonly subject_kind: QualificationTargetKind;
  readonly subject_id: string;
  readonly state: QualificationState;
  readonly version: number;
  readonly effective_at: Date;
  readonly expires_at: Date;
  readonly reviewed_at: Date | null;
  readonly reviewed_by: string | null;
  readonly published_at: Date | null;
  readonly revoked_at: Date | null;
  readonly revoked_by: string | null;
  readonly revoke_reason: string | null;
}

interface PresentedCaseRow extends CaseRow {
  readonly evidence_count: number;
  readonly applicability: readonly Readonly<{ kind: QualificationTargetKind; id: string }>[];
}

interface EvidenceRow extends Record<string, unknown> {
  readonly id: string;
  readonly kind: EvidenceSnapshot['kind'];
  readonly object_ref: string;
  readonly sha256: string;
  readonly state: EvidenceSnapshot['state'];
  readonly verified_at: Date | null;
  readonly verified_by: string | null;
}

export class PgQualificationCaseRepository implements QualificationCaseRepository {
  constructor(private readonly transactions: PgTransactionAccess = new PgTransactionAccess()) {}

  async cases(context: ReadTransactionContext, scope: string, limit: number): Promise<readonly QualificationCaseRecord[]> {
    const result = await this.transactions.database(context).query<PresentedCaseRow>(`${presentationSql} where target.scope_id=$1 order by target.updated_at desc,target.id desc limit $2`, [scope, limit]);
    return Object.freeze(result.rows.map(present));
  }

  async find(context: ReadTransactionContext, scope: string, id: string): Promise<QualificationCaseSnapshot | null> {
    const result = await this.transactions.database(context).query<CaseRow>(`${caseSql} where target.id=$1 and target.scope_id=$2`, [id, scope]);
    return this.hydrate(this.transactions.database(context), result.rows[0]);
  }

  async lock(context: WriteTransactionContext, scope: string, id: string): Promise<QualificationCaseSnapshot | null> {
    const database = this.transactions.database(context);
    const result = await database.query<CaseRow>(`${caseSql} where target.id=$1 and target.scope_id=$2 for update`, [id, scope]);
    return this.hydrate(database, result.rows[0]);
  }

  async save(context: WriteTransactionContext, value: QualificationCaseSnapshot, expectedVersion: number): Promise<QualificationCaseRecord | null> {
    const database = this.transactions.database(context);
    const saved =
      expectedVersion === 0
        ? await database.query<CaseRow>(
            `insert into qualification.qualificationcase(id,scope_id,title,subject_kind,subject_id,state,version,effective_at,expires_at,
            reviewed_at,reviewed_by,published_at,revoked_at,revoked_by,revoke_reason,created_at,updated_at)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp(),clock_timestamp())
            on conflict(id) do nothing returning *`,
            values(value)
          )
        : await database.query<CaseRow>(
            `update qualification.qualificationcase set state=$4,version=$5,published_at=$6,revoked_at=$7,revoked_by=$8,
            revoke_reason=$9,updated_at=clock_timestamp() where id=$1 and scope_id=$2 and version=$3 returning *`,
            [value.id, value.scope, expectedVersion, value.state, value.version, value.publishedAt, value.revokedAt, value.revokedBy, value.revokeReason]
          );
    if (!saved.rows[0]) return null;
    if (expectedVersion === 0) await this.insertMaterial(database, value);
    return this.presentOne(database, value.scope, value.id);
  }

  private async insertMaterial(database: SqlExecutor, value: QualificationCaseSnapshot): Promise<void> {
    for (const item of value.applicability) {
      await database.query(`insert into qualification.casescope(case_id,kind,target_id) values($1,$2,$3)`, [value.id, item.kind, item.id]);
    }
    for (const item of value.evidence) {
      await database.query(
        `insert into qualification.casematerial(id,case_id,kind,object_ref,sha256,state,verified_at,verified_by,created_at)
        values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
        [item.id, value.id, item.kind, item.reference, item.sha256, item.state, item.verifiedAt, item.verifiedBy]
      );
    }
  }

  private async hydrate(database: SqlExecutor, row: CaseRow | undefined): Promise<QualificationCaseSnapshot | null> {
    if (!row) return null;
    const [scopes, materials] = await Promise.all([
      database.query<{ kind: QualificationTargetKind; target_id: string } & Record<string, unknown>>(`select kind,target_id from qualification.casescope where case_id=$1 order by kind,target_id`, [row.id]),
      database.query<EvidenceRow>(`select id,kind,object_ref,sha256,state,verified_at,verified_by from qualification.casematerial where case_id=$1 order by id`, [row.id]),
    ]);
    return Object.freeze({
      id: row.id,
      scope: row.scope_id,
      title: row.title,
      subject: Object.freeze({ kind: row.subject_kind, id: row.subject_id }),
      applicability: Object.freeze(scopes.rows.map((item) => Object.freeze({ kind: item.kind, id: item.target_id } as QualificationTarget))),
      state: row.state,
      version: Number(row.version),
      effectiveAt: row.effective_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      evidence: Object.freeze(
        materials.rows.map((item) =>
          Object.freeze({
            id: item.id,
            kind: item.kind,
            reference: item.object_ref,
            sha256: item.sha256,
            state: item.state,
            verifiedAt: item.verified_at?.toISOString() ?? null,
            verifiedBy: item.verified_by,
          })
        )
      ),
      reviewedAt: row.reviewed_at?.toISOString() ?? null,
      reviewedBy: row.reviewed_by,
      publishedAt: row.published_at?.toISOString() ?? null,
      revokedAt: row.revoked_at?.toISOString() ?? null,
      revokedBy: row.revoked_by,
      revokeReason: row.revoke_reason,
    });
  }

  private async presentOne(database: SqlExecutor, scope: string, id: string): Promise<QualificationCaseRecord> {
    const result = await database.query<PresentedCaseRow>(`${presentationSql} where target.scope_id=$1 and target.id=$2`, [scope, id]);
    const row = result.rows[0];
    if (!row) throw new Error('QUALIFICATION_CASE_SAVE_FAILED');
    return present(row);
  }
}

const caseFields = `target.id,target.scope_id,target.title,target.subject_kind,target.subject_id,target.state,
target.version::integer version,target.effective_at,target.expires_at,target.reviewed_at,target.reviewed_by,target.published_at,
target.revoked_at,target.revoked_by,target.revoke_reason`;
const caseSql = `select ${caseFields} from qualification.qualificationcase target`;

const presentationSql = `select ${caseFields},target.updated_at,
(select count(*)::integer from qualification.casematerial material where material.case_id=target.id) evidence_count,
coalesce((select jsonb_agg(jsonb_build_object('kind',scope.kind,'id',scope.target_id) order by scope.kind,scope.target_id)
from qualification.casescope scope where scope.case_id=target.id),'[]'::jsonb) applicability from qualification.qualificationcase target`;

function values(value: QualificationCaseSnapshot): readonly unknown[] {
  return [
    value.id,
    value.scope,
    value.title,
    value.subject.kind,
    value.subject.id,
    value.state,
    value.version,
    value.effectiveAt,
    value.expiresAt,
    value.reviewedAt,
    value.reviewedBy,
    value.publishedAt,
    value.revokedAt,
    value.revokedBy,
    value.revokeReason,
  ];
}

function present(row: PresentedCaseRow): QualificationCaseRecord {
  return Object.freeze({
    id: row.id,
    title: row.title,
    subject_kind: row.subject_kind,
    subject_id: row.subject_id,
    state: row.state,
    version: Number(row.version),
    effective_at: row.effective_at.toISOString(),
    expires_at: row.expires_at.toISOString(),
    reviewed_at: row.reviewed_at?.toISOString() ?? null,
    published_at: row.published_at?.toISOString() ?? null,
    revoked_at: row.revoked_at?.toISOString() ?? null,
    revoke_reason: row.revoke_reason,
    evidence_count: Number(row.evidence_count),
    applicability: Object.freeze(row.applicability.map((item) => Object.freeze({ ...item }))),
  });
}
