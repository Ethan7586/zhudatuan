import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
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
