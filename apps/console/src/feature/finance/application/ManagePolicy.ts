import { OP_FINANCE_POLICIES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePolicyPreview, PolicyDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';

export class ManagePolicy {
  constructor(private readonly port: Pick<FinancePort, 'managePolicy'>) {}
  execute(context: ConsoleContext, draft: PolicyDraft, preview: FinancePolicyPreview, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_POLICIES_MANAGE, proof);
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(proof) || !identity || preview.policy.id !== draft.id || preview.policy.version !== draft.expectedVersion) throw new Error('VALIDATION_FAILED');
    return this.port.managePolicy(context, draft, preview, proof, identity, signal);
  }
}
