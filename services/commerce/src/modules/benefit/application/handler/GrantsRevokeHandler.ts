import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { GrantRepository } from '../port/GrantRepository';
export class GrantsRevokeHandler implements OperationHandler<'benefit.grants.revoke', 'write'> {
  readonly operation = 'benefit.grants.revoke' as const;
  readonly mode = 'write' as const;
  constructor(private readonly grants: GrantRepository) {}
  async execute(input: OperationInputFor<'benefit.grants.revoke'>, context: WriteHandlerContext<'benefit.grants.revoke'>) {
    const result = await this.grants.revokeGrant(context.transaction, input, context);
    return result;
  }
}
