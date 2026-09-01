import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReferralRepository } from '../port/ReferralRepository';

export class SettingsReadHandler implements OperationHandler<'referral.settings.read', 'read'> {
  readonly operation = 'referral.settings.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly referrals: ReferralRepository) {}
  async execute(_input: OperationInputFor<'referral.settings.read'>, context: HandlerContext<'referral.settings.read'>): Promise<OperationReply<OperationOutputFor<'referral.settings.read'>>> {
    const setting = await this.referrals.setting(context.transaction, requireSession(context.security).scope.id);
    if (!setting) throw new DomainError('RESOURCE_NOT_FOUND');
    return { status: 200, body: setting as OperationOutputFor<'referral.settings.read'> };
  }
}
