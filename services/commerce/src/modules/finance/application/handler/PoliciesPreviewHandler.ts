import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { PolicyProcessAdapter } from '../port/FinanceProcessAdapter';

export class PoliciesPreviewHandler implements OperationHandler<'finance.policies.preview', 'write'> {
  readonly operation = 'finance.policies.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly policies: PolicyProcessAdapter) {}
  async execute(input: OperationInputFor<'finance.policies.preview'>, context: WriteHandlerContext<'finance.policies.preview'>) {
    const result = await this.policies.policiesPreview(context.transaction, input, context);
    return result;
  }
}
