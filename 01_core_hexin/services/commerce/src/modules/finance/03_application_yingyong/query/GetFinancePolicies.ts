import { requireAccess, type OperationActions } from '../../../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../../../foundation/interface/Validation';

export function getFinancePoliciesOperations(): OperationActions {
  return {
    'finance.policies.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `with latest as(
          select distinct on(revision.policy_id) revision.policy_id id,revision.scope_id,revision.kind,revision.rule,
            case revision.state when 'submitted' then 'pending_review' when 'rejected' then 'draft' else revision.state end state,
            revision.version,revision.desired_state,revision.effective_from,revision.effective_to,
            revision.revision_hash,revision.preview_hash,revision.proposed_by,revision.submitted_by,
            revision.approved_by,revision.rejected_by
          from finance.policyrevision revision
          where access.scope_allowed(revision.scope_id)
            and revision.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          order by revision.policy_id,revision.version desc
        ),visible as(
          select * from latest
          union all
          select policy.id,policy.scope_id,policy.kind,policy.rule,policy.state,policy.version,
            case policy.state when 'retired' then 'retired' else 'active' end,
            null::date,null::date,null::char(64),null::char(64),null::text,null::text,null::text,null::text
          from finance.policy policy where access.scope_allowed(policy.scope_id)
            and policy.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
            and not exists(select 1 from latest where latest.id=policy.id)
        ) select * from visible where ($2::text is null or id>$2) order by id limit $3`,
        [access.scope.id, page.id, page.fetch],
      );
      return keysetResult(result, page, 'id');
    },
  };
}
