import { useSearchParams } from 'react-router';
import type { ApprovalDependencies, FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { useFinanceNavigationViewModel } from './NavigationViewModel';
import { usePolicyGovernance } from './PolicyGovernance';
import { useRepairGovernance } from './RepairGovernance';

export type GovernanceView = 'policies' | 'repairs';

export function usePolicyViewModel(context: ConsoleContext, finance: FinanceDependencies, approval: ApprovalDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const view: GovernanceView = search.get('area') === 'repairs' ? 'repairs' : 'policies';
  const cursor = search.get('cursor') ?? undefined;
  const policy = usePolicyGovernance(context, finance, cursor, view === 'policies', requestStepup);
  const repair = useRepairGovernance(context, finance, approval, cursor, view === 'repairs', requestStepup);
  const current = view === 'policies' ? policy : repair;

  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'policies'),
    view,
    cursor,
    policies: policy.data,
    repairs: repair.data,
    policyEditor: policy.editor,
    repairEditor: repair.editor,
    policyPreview: policy.preview,
    repairPreview: repair.preview,
    approval: repair.approval,
    condition: current.condition,
    error: current.error,
    fetching: current.fetching,
    busy: policy.busy || repair.busy,
    policyError: policy.mutationError,
    repairError: repair.mutationError,
    policyValidation: policy.validation,
    repairValidation: repair.validation,
    receipt: current.receipt,
    assurance: context.session.assurance.level,
    can: Object.freeze({ policyManage: policy.canManage, repairSubmit: repair.can.submit, repairApprove: repair.can.approve, repairReject: repair.can.reject, repairReverse: repair.can.reverse }),
    actions: Object.freeze({
      view: (nextView: GovernanceView) => setSearch((currentSearch) => {
        const next = new URLSearchParams(currentSearch);
        next.delete('cursor');
        if (nextView === 'policies') next.delete('area');
        else next.set('area', 'repairs');
        return next;
      }),
      next: (value: string) => setSearch((currentSearch) => { const next = new URLSearchParams(currentSearch); next.set('cursor', value); return next; }),
      first: () => setSearch((currentSearch) => { const next = new URLSearchParams(currentSearch); next.delete('cursor'); return next; }),
      refresh: current.actions.refresh,
      createPolicy: policy.actions.create,
      editPolicy: policy.actions.edit,
      retirePolicy: policy.actions.retire,
      policyField: policy.actions.field,
      policyEntry: policy.actions.entry,
      addPolicyEntry: policy.actions.addEntry,
      removePolicyEntry: policy.actions.removeEntry,
      previewPolicy: policy.actions.preview,
      policyProof: policy.actions.proof,
      policyConfirmed: policy.actions.confirmed,
      submitPolicy: policy.actions.submit,
      closePolicy: policy.actions.close,
      createRepair: repair.actions.create,
      reviewRepair: repair.actions.review,
      reverseRepair: repair.actions.reverse,
      repairField: repair.actions.field,
      repairEntry: repair.actions.entry,
      addRepairEntry: repair.actions.addEntry,
      removeRepairEntry: repair.actions.removeEntry,
      previewRepair: repair.actions.preview,
      repairProof: repair.actions.proof,
      repairConfirmed: repair.actions.confirmed,
      repairReason: repair.actions.reason,
      submitRepair: repair.actions.submit,
      decideRepair: repair.actions.decide,
      submitReverse: repair.actions.submitReverse,
      retryApproval: repair.actions.retryApproval,
      closeRepair: repair.actions.close,
      stepup: requestStepup,
      dismissReceipt: current.actions.dismissReceipt,
    }),
  });
}

export type PolicyViewModel = ReturnType<typeof usePolicyViewModel>;
