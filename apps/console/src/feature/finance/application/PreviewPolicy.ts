import { OP_FINANCE_POLICIES_PREVIEW } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { policyValidation, type PolicyDraft } from '../model/FinanceGovernance';
import type { FinancePort } from '../public';

export class PreviewPolicy {
  constructor(private readonly port: Pick<FinancePort, 'previewPolicy'>) {}
  execute(context: ConsoleContext, draft: PolicyDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_FINANCE_POLICIES_PREVIEW);
    if (policyValidation(draft) || !identity) throw new Error('VALIDATION_FAILED');
    return this.port.previewPolicy(context, draft, identity, signal);
  }
}
