import type { ClaimedJob, JobProcessor } from '../../../runtime/public/JobProcess';
import type { ApplyQualificationRisk } from '../../application/process/ApplyQualificationRisk';
import type { ApplyRiskAction } from '../../application/process/ApplyRiskAction';
import type { EvaluateDeferredRisk } from '../../application/process/EvaluateDeferredRisk';
import type { ReplayRiskPolicy } from '../../application/process/ReplayRiskPolicy';

export class RiskScanJob implements JobProcessor {
  constructor(
    private readonly replay: ReplayRiskPolicy,
    private readonly qualification: ApplyQualificationRisk,
    private readonly actions: ApplyRiskAction,
    private readonly deferred: EvaluateDeferredRisk
  ) {}

  process(job: ClaimedJob, signal: AbortSignal, deadline = Date.now() + 30_000): Promise<void> {
    if (job.kind !== 'riskscan') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = record(job.payload, 'JOB_PAYLOAD_INVALID');
    const execution = { scope: job.scope || 'risk', trace: job.id, signal, deadline };
    if (typeof payload.action === 'string') return this.actions.apply(payload.action, execution);
    if (typeof payload.assessment === 'string') return this.deferred.execute(payload.assessment, execution);
    if (typeof payload.event === 'string' && payload.event.startsWith('approval.instance.')) {
      if (payload.event !== 'approval.instance.approved' && payload.event !== 'approval.instance.rejected') throw new Error('RISK_APPROVAL_EVENT_INVALID');
      const facts = record(payload.payload, 'RISK_APPROVAL_EVENT_PAYLOAD_INVALID');
      if (facts.subjectKind !== 'riskaction') return Promise.resolve();
      return this.actions.approvalEvent(
        {
          type: payload.event,
          instance: text(facts.instanceId, 'RISK_APPROVAL_INSTANCE_REQUIRED'),
          subject: text(facts.subjectId, 'RISK_APPROVAL_SUBJECT_REQUIRED'),
          subjectVersion: integer(facts.subjectVersion, 'RISK_APPROVAL_SUBJECT_VERSION_REQUIRED'),
          action: actionKind(facts.action),
          proof: payload.event === 'approval.instance.approved' ? text(facts.proofId, 'RISK_APPROVAL_PROOF_REQUIRED') : null,
        },
        execution
      );
    }
    if (typeof payload.event === 'string' && payload.event.startsWith('qualification.')) {
      const event = payload.event;
      if (!['qualification.changed', 'qualification.expired', 'qualification.revoked'].includes(event)) throw new Error('QUALIFICATION_EVENT_TYPE_INVALID');
      const facts = record(payload.payload, 'QUALIFICATION_EVENT_PAYLOAD_INVALID');
      return this.qualification.apply(
        {
          event: text(payload.eventId, 'QUALIFICATION_EVENT_ID_REQUIRED'),
          type: event as 'qualification.changed' | 'qualification.expired' | 'qualification.revoked',
          qualification: text(facts.qualificationId, 'QUALIFICATION_ID_REQUIRED'),
          subjectKind: text(facts.subjectKind, 'QUALIFICATION_SUBJECT_KIND_REQUIRED'),
          subjectId: text(facts.subjectId, 'QUALIFICATION_SUBJECT_ID_REQUIRED'),
          productIds: texts(facts.productIds, 'QUALIFICATION_PRODUCT_IDS_INVALID'),
          categoryIds: texts(facts.categoryIds, 'QUALIFICATION_CATEGORY_IDS_INVALID'),
          regionIds: texts(facts.regionIds, 'QUALIFICATION_REGION_IDS_INVALID'),
          state: text(facts.state, 'QUALIFICATION_STATE_REQUIRED'),
        },
        execution
      );
    }
    return this.replay.replay(text(payload.policy, 'RISK_POLICY_REQUIRED'), integer(payload.version, 'RISK_POLICY_VERSION_REQUIRED'), execution);
  }
}

function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error(code);
  return value as number;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value) throw new Error(code);
  return value;
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function texts(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string' || !item)) throw new Error(code);
  return Object.freeze([...value] as string[]);
}

function actionKind(value: unknown): string {
  const action = text(value, 'RISK_APPROVAL_ACTION_REQUIRED');
  if (!action.startsWith('risk.')) throw new Error('RISK_APPROVAL_ACTION_INVALID');
  return action.slice(5);
}
