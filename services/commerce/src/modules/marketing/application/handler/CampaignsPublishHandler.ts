import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { campaignEvent } from '../../domain/event/MarketingEvents';
import type { CampaignRepository } from '../port/CampaignRepository';

export class CampaignsPublishHandler implements OperationHandler<'marketing.campaigns.publish', 'write'> {
  readonly operation = 'marketing.campaigns.publish' as const;
  readonly mode = 'write' as const;
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(input: OperationInputFor<'marketing.campaigns.publish'>, context: WriteHandlerContext<'marketing.campaigns.publish'>): Promise<OperationReply<OperationOutputFor<'marketing.campaigns.publish'>>> {
    const access = requireSession(context.security);
    const campaign = await this.campaigns.publish(context.transaction, access.scope.id, input.path.campaignid, context.expectedVersion!, access.actor.id);
    if (!campaign) throw new DomainError('VERSION_CONFLICT');
    return {
      status: 200,
      body: campaign as unknown as OperationOutputFor<'marketing.campaigns.publish'>,
      events: [campaignEvent('marketing.campaign.published', { id: campaign.id, scope: campaign.scope_id, state: campaign.state, version: campaign.version }, { actor: access.actor.id, trace: context.traceId })],
    };
  }
}
