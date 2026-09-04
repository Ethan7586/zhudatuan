import { deepFreeze } from '../../../../shared/model/Immutable';
import type { ContractJsonValue } from '@shop/contract';
import type { PolicyImpact, PolicyReceipt, QualificationDecision, QualificationPage, QualificationPolicy } from '../model/Policy';
import type { QualificationCase } from '../model/Qualification';
import { QualificationManageSchema, QualificationPageSchema, QualificationPreviewSchema, QualificationPublishSchema, QualificationRevokeSchema } from './QualificationSchema';

export class QualificationMapper {
  page(value: unknown): QualificationPage {
    const parsed = QualificationPageSchema.parse(value);
    if (parsed.count !== parsed.items.length) throw new Error('QUALIFICATION_PAGE_COUNT_MISMATCH');
    return deepFreeze({ items: parsed.items.map(policy), cases: parsed.cases.map(qualification), count: parsed.count, ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor }) });
  }

  preview(value: unknown): Readonly<{ kind: 'policy'; impact: PolicyImpact }> | Readonly<{ kind: 'decision'; decisions: readonly QualificationDecision[] }> {
    const parsed = QualificationPreviewSchema.parse(value);
    if (parsed.kind === 'decision') return deepFreeze({ kind: 'decision', decisions: parsed.decisions.map((item) => ({ policyId: item.policy_id, policyVersion: item.policy_version, decision: item.decision })) });
    const item = parsed.impact;
    return deepFreeze({
      kind: 'policy',
      impact: {
        action: item.action,
        policyId: item.policy_id,
        currentVersion: item.current_version,
        nextVersion: item.next_version,
        sourceVersion: item.source_version,
        currentHash: item.current_hash,
        proposedHash: item.proposed_hash,
        changedFields: item.changed_fields,
        potentialProfiles: item.potential_profiles,
        resourceCount: item.resource_count,
        subjectCount: item.subject_count,
        limitCount: item.limit_count,
      },
    });
  }

  receipt(value: unknown): PolicyReceipt {
    const item = QualificationManageSchema.parse(value);
    return deepFreeze({ id: item.id, name: item.name, activeVersion: item.active_version, ruleHash: item.rule_hash, action: item.action, sourceVersion: item.source_version, updatedAt: item.updated_at });
  }

  qualification(value: unknown, schema: 'publish' | 'revoke'): QualificationCase {
    const item = (schema === 'publish' ? QualificationPublishSchema : QualificationRevokeSchema).parse(value);
    return deepFreeze(qualification(item));
  }
}

function qualification(item: ReturnType<typeof QualificationPublishSchema.parse>): QualificationCase {
  return {
    id: item.id,
    title: item.title,
    subject: { kind: item.subject_kind, id: item.subject_id },
    state: item.state,
    version: item.version,
    effectiveAt: item.effective_at,
    expiresAt: item.expires_at,
    reviewedAt: item.reviewed_at,
    publishedAt: item.published_at,
    revokedAt: item.revoked_at,
    revokeReason: item.revoke_reason,
    evidenceCount: item.evidence_count,
    applicability: item.applicability.map((target) => ({ ...target })),
  };
}

function policy(item: ReturnType<typeof QualificationPageSchema.parse>['items'][number]): QualificationPolicy {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    activeVersion: item.active_version,
    updatedAt: item.updated_at,
    rule: object(item.rule),
    ruleHash: item.rule_hash,
    publishedAt: item.published_at,
    versions: item.versions.map((version) => ({ version: version.version, ruleHash: version.rule_hash, publishedAt: version.published_at, createdBy: version.created_by })),
  };
}

function object(value: unknown): Readonly<Record<string, ContractJsonValue>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('QUALIFICATION_RULE_OBJECT_REQUIRED');
  return value as Readonly<Record<string, ContractJsonValue>>;
}
