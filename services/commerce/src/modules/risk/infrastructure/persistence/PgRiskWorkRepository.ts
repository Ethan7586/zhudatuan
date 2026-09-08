import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DeferredRiskRecord, RiskActionRecord, RiskWorkRepository } from '../../application/port/RiskWorkRepository';
import { signal, type SignalSensitivity } from '../../domain/model/Signal';

interface ActionRow {
  readonly id: string;
  readonly decision: string;
  readonly scope: string;
  readonly kind: RiskActionRecord['kind'];
  readonly targetModule: RiskActionRecord['target']['module'];
  readonly targetType: string;
  readonly targetId: string;
  readonly rationale: string;
  readonly approvalRequired: boolean;
  readonly approvalInstance: string | null;
  readonly approvalProof: string | null;
  readonly evidenceHash: string;
  readonly state: RiskActionRecord['state'];
  readonly version: number;
  readonly requester: string;
  readonly expiresAt: string;
}

interface AssessmentRow {
  readonly id: string;
  readonly scope: string;
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly scopes: unknown;
  readonly amountMinor: string | number | null;
  readonly signals: unknown;
  readonly risk: DeferredRiskRecord['risk'];
  readonly trace: string;
}

export class PgRiskWorkRepository implements RiskWorkRepository {
  private readonly transactions = new PgTransactionAccess();

  async action(context: WriteTransactionContext, id: string): Promise<RiskActionRecord | null> {
    const result = await this.transactions.database(context).query<ActionRow>(
      `select action.id,action.decision_id decision,action.scope_id scope,action.kind,action.target_module "targetModule",
      action.target_type "targetType",action.target_id "targetId",action.rationale,action.approval_required "approvalRequired",
      action.approval_instance "approvalInstance",action.evidence_hash "evidenceHash",action.state,action.version,
      action.approval_proof "approvalProof",
      coalesce(decision.actor_id,'system:risk') requester,action.expires_at "expiresAt"
      from risk.action action join risk.decision decision on decision.id=action.decision_id where action.id=$1 for update of action`,
      [id]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          id: row.id,
          decision: row.decision,
          scope: row.scope,
          kind: row.kind,
          target: Object.freeze({ module: row.targetModule, type: row.targetType, id: row.targetId }),
          rationale: row.rationale,
          approvalRequired: row.approvalRequired,
          approvalInstance: row.approvalInstance,
          approvalProof: row.approvalProof,
          evidenceHash: row.evidenceHash,
          state: row.state,
          version: Number(row.version),
          requester: row.requester,
          expiresAt: row.expiresAt,
        })
      : null;
  }

  async bindApproval(context: WriteTransactionContext, id: string, version: number, instance: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `update risk.action set approval_instance=$3,version=version+1,updated_at=clock_timestamp()
      where id=$1 and version=$2 and state='approvalrequired' and approval_instance is null`,
      [id, version, instance]
    );
    return result.rowCount === 1;
  }

  async approve(context: WriteTransactionContext, instance: string, id: string, subjectVersion: number, kind: string, proof: string): Promise<string | null> {
    const result = await this.transactions.database(context).query<{ id: string }>(
      `update risk.action set state='approved',approval_proof=$5,version=version+1,updated_at=clock_timestamp()
      where id=$2 and approval_instance=$1 and version=$3+1 and kind=$4 and state='approvalrequired'
        and expires_at>clock_timestamp() returning id`,
      [instance, id, subjectVersion, kind, proof]
    );
    return result.rows[0]?.id ?? null;
  }

  async reject(context: WriteTransactionContext, instance: string, id: string, subjectVersion: number, kind: string): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `update risk.action set state='rejected',version=version+1,updated_at=clock_timestamp()
      where id=$2 and approval_instance=$1 and version=$3+1 and kind=$4 and state='approvalrequired'`,
      [instance, id, subjectVersion, kind]
    );
    return result.rowCount === 1;
  }

  async applied(context: WriteTransactionContext, id: string, version: number): Promise<boolean> {
    const result = await this.transactions.database(context).query(
      `update risk.action set state='applied',version=version+1,updated_at=clock_timestamp()
      where id=$1 and version=$2 and state in('proposed','approved')`,
      [id, version]
    );
    return result.rowCount === 1;
  }

  async assessment(context: WriteTransactionContext, id: string): Promise<DeferredRiskRecord | null> {
    const result = await this.transactions.database(context).query<AssessmentRow>(
      `update risk.assessment set state='running' where id=$1 and state in('queued','running') and expires_at>clock_timestamp()
      returning id,scope_id scope,actor_id actor,operation,resource_id resource,scope_chain scopes,amount_minor "amountMinor",
        signals,operation_risk risk,trace_id trace`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      id: row.id,
      scope: row.scope,
      actor: row.actor,
      operation: row.operation,
      resource: row.resource,
      scopes: texts(row.scopes),
      amountMinor: row.amountMinor === null ? null : Number(row.amountMinor),
      signals: signals(row.signals),
      risk: row.risk,
      trace: row.trace,
    });
  }

  async completeAssessment(context: WriteTransactionContext, id: string, succeeded: boolean): Promise<void> {
    await this.transactions.database(context).query(`update risk.assessment set state=$2,completed_at=clock_timestamp() where id=$1 and state='running'`, [id, succeeded ? 'completed' : 'failed']);
  }
}

function texts(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100 || value.some((item) => typeof item !== 'string' || !item)) throw new Error('RISK_ASSESSMENT_SCOPES_INVALID');
  return Object.freeze([...value] as string[]);
}

function signals(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) throw new Error('RISK_ASSESSMENT_SIGNALS_INVALID');
  return Object.freeze(
    value.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('RISK_ASSESSMENT_SIGNAL_INVALID');
      const item = candidate as Record<string, unknown>;
      if (typeof item.value !== 'number') return [];
      return [
        signal({
          type: required(item.type),
          version: positive(item.version),
          value: item.value,
          source: required(item.source),
          sensitivity: sensitivity(item.sensitivity),
          observedAt: required(item.observedAt),
        }),
      ];
    })
  );
}

function required(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('RISK_ASSESSMENT_TEXT_INVALID');
  return value;
}

function positive(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('RISK_ASSESSMENT_VERSION_INVALID');
  return value as number;
}

function sensitivity(value: unknown): SignalSensitivity {
  if (value !== 'public' && value !== 'personal' && value !== 'sensitive') throw new Error('RISK_ASSESSMENT_SENSITIVITY_INVALID');
  return value;
}
