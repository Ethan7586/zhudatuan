import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReferralRepository } from '../port/ReferralRepository';

export class BindingsReadHandler implements OperationHandler<'referral.bindings.read', 'read'> {
  readonly operation = 'referral.bindings.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(input: OperationInputFor<'referral.bindings.read'>, context: HandlerContext<'referral.bindings.read'>): Promise<OperationReply<OperationOutputFor<'referral.bindings.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const personal = ['owner', 'self'].includes(access.scope.kind);
    const member = personal ? await this.referrals.eligible(context.transaction, access.scope.id, access.membership.id) : null;
    if (personal && !member) throw new DomainError('REFERRAL_NOT_ELIGIBLE');
    const scope = member?.scopeId ?? access.scope.id;
    const rows = await this.referrals.bindings(context.transaction, scope, member?.memberId ?? null, page);
    return { status: 200, body: keysetPage(rows, page, 'id') as OperationOutputFor<'referral.bindings.read'> };
  }
}
