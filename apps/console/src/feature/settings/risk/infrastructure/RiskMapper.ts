import type { ContractJsonValue } from '@shop/contract';
import { deepFreeze } from '../../../../shared/model/Immutable';
import type { RiskCase, RiskCaseAction, RiskPage, RiskPolicy, RiskReceipt } from '../model/Risk';
import { RiskCaseReceiptSchema, RiskPageSchema, RiskPolicyReceiptSchema } from './RiskSchema';

type PageItem = ReturnType<typeof RiskPageSchema.parse>['items'][number];

export class RiskMapper {
  page(value: unknown): RiskPage {
    const parsed = RiskPageSchema.parse(value);
    if (parsed.count !== parsed.items.length) throw new Error('RISK_PAGE_COUNT_MISMATCH');
    const items = parsed.items.map((item) => (item.kind === 'policy' ? policy(item) : riskCase(item)));
    return deepFreeze({ items, count: parsed.count, ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor }) });
  }

  policyReceipt(value: unknown, action: 'save' | 'activate' | 'retire'): RiskReceipt {
    const item = RiskPolicyReceiptSchema.parse(value);
    return deepFreeze({
      kind: 'policy',
      id: item.id,
      version: item.version,
      state: item.status,
      action,
      candidateVersion: 'candidate_version' in item ? item.candidate_version : null,
      activeVersion: item.active_version,
    });
  }

  caseReceipt(value: unknown, action: RiskCaseAction): RiskReceipt {
    const item = RiskCaseReceiptSchema.parse(value);
    return deepFreeze({ kind: 'case', id: item.id, version: item.version, state: item.state, action });
  }
}

function policy(item: PageItem): RiskPolicy {
  return deepFreeze({
    kind: 'policy',
    id: item.id,
    version: required(item.version),
    name: required(item.name),
    status: status(item.status),
    activeVersion: item.active_version,
    baselineVersion: item.baseline_version,
    rolloutPercent: item.rollout_percent,
    ruleHash: item.rule_hash,
    rule: object(item.rule),
    candidateVersion: item.candidate_version,
    candidateRollout: item.candidate_rollout,
    candidateHash: item.candidate_hash,
    candidateRule: object(item.candidate_rule),
    replayState: replay(item.replay_state),
    sampleCount: item.sample_count,
    changedCount: item.changed_count,
    falsePositiveRate: item.false_positive_rate,
    preview: item.preview,
  });
}

function riskCase(item: PageItem): RiskCase {
  return deepFreeze({
    kind: 'case',
    id: item.id,
    version: required(item.version),
    decisionId: required(item.decision_id),
    outcome: outcome(item.outcome),
    state: caseState(item.case_state),
    reason: reason(item.safe_reason),
    actorId: item.actor_id,
    actorName: item.actor_display_name,
    actorMobile: item.actor_mobile_masked,
    score: required(item.score),
    evidence: item.evidence,
    createdAt: required(item.created_at),
  });
}

function object(value: ContractJsonValue | null): Readonly<Record<string, ContractJsonValue>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('RISK_RULE_OBJECT_REQUIRED');
  return value as Readonly<Record<string, ContractJsonValue>>;
}
function required<T>(value: T | null): T {
  if (value === null) throw new Error('RISK_CENTER_FIELD_REQUIRED');
  return value;
}
function status(value: string | null): RiskPolicy['status'] {
  if (value === 'draft' || value === 'active' || value === 'retired') return value;
  throw new Error('RISK_POLICY_STATUS_INVALID');
}
function replay(value: string | null): RiskPolicy['replayState'] {
  if (value === null || value === 'queued' || value === 'running' || value === 'passed' || value === 'review' || value === 'failed') return value;
  throw new Error('RISK_REPLAY_STATE_INVALID');
}
function outcome(value: string | null): RiskCase['outcome'] {
  if (value === 'review' || value === 'deny') return value;
  throw new Error('RISK_CASE_OUTCOME_INVALID');
}
function caseState(value: string | null): RiskCase['state'] {
  if (value === 'open' || value === 'reviewing' || value === 'cleared' || value === 'confirmed' || value === 'closed') return value;
  throw new Error('RISK_CASE_STATE_INVALID');
}
function reason(value: string | null): RiskCase['reason'] {
  if (value === 'policy' || value === 'amount' || value === 'velocity' || value === 'signal' || value === 'list') return value;
  throw new Error('RISK_CASE_REASON_INVALID');
}
