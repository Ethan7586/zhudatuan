import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { PolicyRepository } from '../port/OperationRepositories';

export class PoliciesPreviewHandler implements OperationHandler<'finance.policies.preview', 'write'> {
  readonly operation = 'finance.policies.preview' as const;
  readonly mode = 'write' as const;
  constructor(private readonly policies: PolicyRepository) {}
  async execute(input: OperationInputFor<'finance.policies.preview'>, context: WriteHandlerContext<'finance.policies.preview'>) {
    const result = await this.policies.policiesPreview(context.transaction, input, context);
    return result;
  }
}
