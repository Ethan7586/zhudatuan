import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { campaignEvent } from '../../domain/event/MarketingEvents';
import type { CampaignRepository } from '../port/CampaignRepository';

export class CampaignsDisableHandler implements OperationHandler<'marketing.campaigns.disable', 'write'> {
  readonly operation = 'marketing.campaigns.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(input: OperationInputFor<'marketing.campaigns.disable'>, context: WriteHandlerContext<'marketing.campaigns.disable'>): Promise<OperationReply<OperationOutputFor<'marketing.campaigns.disable'>>> {
    const access = requireSession(context.security);
    const campaign = await this.campaigns.disable(context.transaction, access.scope.id, input.path.campaignid, context.expectedVersion!, access.actor.id, textField(bodyRecord(input), 'reason', 500));
    if (!campaign) throw new DomainError('VERSION_CONFLICT');
    return {
      status: 200,
      body: campaign as unknown as OperationOutputFor<'marketing.campaigns.disable'>,
      events: [campaignEvent('marketing.campaign.disabled', { id: campaign.id, scope: campaign.scope_id, state: campaign.state, version: campaign.version }, { actor: access.actor.id, trace: context.traceId })],
    };
  }
}
