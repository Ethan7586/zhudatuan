import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ReferralRepository } from '../port/ReferralRepository';

export class ProductsReadHandler implements OperationHandler<'referral.products.read', 'read'> {
  readonly operation = 'referral.products.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.products.read'>, context: HandlerContext<'referral.products.read'>): Promise<OperationReply<OperationOutputFor<'referral.products.read'>>> {
    const page = queryPage(input);
    const rows = await this.referrals.products(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'referral.products.read'> };
  }
}
