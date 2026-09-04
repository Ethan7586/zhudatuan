import { ContractJsonValueSchema, type ContractJsonValue, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { changedRuleFields, QualificationRule } from '../../domain/model/QualificationRule';
import type { QualificationRepository } from '../port/QualificationRepository';

export class DecisionsPreviewHandler implements OperationHandler<'qualification.decisions.preview', 'write'> {
  readonly operation = 'qualification.decisions.preview' as const;
  readonly mode = 'write' as const;

  constructor(private readonly qualifications: QualificationRepository) {}

  async execute(input: OperationInputFor<'qualification.decisions.preview'>, context: WriteHandlerContext<'qualification.decisions.preview'>): Promise<OperationReply<OperationOutputFor<'qualification.decisions.preview'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (body.kind === 'decision') {
      const decisions = await this.qualifications.previewDecision(context.transaction, access.scope.id, textField(body, 'member'), textField(body, 'resource'));
      return { status: 200, body: { kind: 'decision', decisions: [...decisions] } };
    }
    const id = textField(body, 'policy');
    const action = body.kind;
    if (action !== 'publish' && action !== 'rollback') throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    const sourceVersion = action === 'rollback' ? integerField(body, 'version', 1) : null;
    const basis = await this.qualifications.previewPolicy(context.transaction, { scope: access.scope.id, id, sourceVersion });
    if (!basis || (sourceVersion !== null && sourceVersion === basis.currentVersion)) throw new DomainError('VALIDATION_FAILED', { field: 'version' });
    const proposed = action === 'publish' ? new QualificationRule(ContractJsonValueSchema.parse(body.rule)) : new QualificationRule(requiredRule(basis.sourceRule));
    const changed = [...changedRuleFields(basis.currentRule, proposed.value)];
    if (action === 'publish' && textField(body, 'name') !== basis.currentName) changed.unshift('name');
    if (action === 'rollback') changed.unshift('versionSnapshot');
    return {
      status: 200,
      body: {
        kind: 'policy',
        impact: {
          action,
          policy_id: id,
          current_version: basis.currentVersion,
          next_version: (basis.currentVersion ?? 0) + 1,
          source_version: basis.sourceVersion,
          current_hash: basis.currentHash,
          proposed_hash: proposed.hash,
          changed_fields: [...new Set(changed)],
          potential_profiles: basis.potentialProfiles,
          resource_count: basis.resourceCount,
          subject_count: basis.subjectCount,
          limit_count: basis.limitCount,
        },
      },
    } as OperationReply<OperationOutputFor<'qualification.decisions.preview'>>;
  }
}

function requiredRule(value: ContractJsonValue | null): ContractJsonValue {
  if (value === null) throw new DomainError('VALIDATION_FAILED', { field: 'version' });
  return value;
}
