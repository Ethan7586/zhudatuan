import { OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE, OP_FINANCE_RECONCILIATIONREPAIRS_PREVIEW, OP_FINANCE_RECONCILIATIONREPAIRS_REVERSE, OP_FINANCE_RECONCILIATIONREPAIRS_SUBMIT } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { repairValidation, type FinanceRepair, type FinanceRepairPreview, type RepairDecision, type RepairDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';

export class ManageRepair {
  constructor(private readonly port: Pick<FinancePort, 'previewRepair' | 'submitRepair' | 'decideRepair' | 'reverseRepair'>) {}

  preview(context: ConsoleContext, draft: RepairDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONREPAIRS_PREVIEW);
    if (repairValidation(draft) || !identity) throw new Error('VALIDATION_FAILED');
    return this.port.previewRepair(context, draft, identity, signal);
  }

  submit(context: ConsoleContext, draft: RepairDraft, preview: FinanceRepairPreview, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONREPAIRS_SUBMIT, proof);
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(proof) || !identity || preview.repair.statementId !== draft.statementId) throw new Error('VALIDATION_FAILED');
    return this.port.submitRepair(context, draft, preview, proof, identity, signal);
  }

  decide(context: ConsoleContext, repair: FinanceRepair, decision: RepairDecision, reason: string, approvalProof: string | undefined, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE);
    if (!identity || reason.trim().length < 2 || (decision === 'approve' && !/^[A-Za-z0-9_-]{43,128}$/.test(approvalProof ?? ''))) throw new Error('VALIDATION_FAILED');
    return this.port.decideRepair(context, repair, decision, reason, approvalProof, identity, signal);
  }

  reverse(context: ConsoleContext, repair: FinanceRepair, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_RECONCILIATIONREPAIRS_REVERSE, proof);
    if (!identity || reason.trim().length < 2 || !/^[A-Za-z0-9_-]{43,128}$/.test(proof)) throw new Error('VALIDATION_FAILED');
    return this.port.reverseRepair(context, repair, reason, proof, identity, signal);
  }
}
