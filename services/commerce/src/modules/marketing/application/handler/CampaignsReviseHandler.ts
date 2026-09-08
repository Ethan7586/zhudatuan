import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { campaignEvent } from '../../domain/event/MarketingEvents';
import { campaignRevision } from '../model/CampaignInput';
import type { CampaignRepository } from '../port/CampaignRepository';

export class CampaignsReviseHandler implements OperationHandler<'marketing.campaigns.revise', 'write'> {
  readonly operation = 'marketing.campaigns.revise' as const;
  readonly mode = 'write' as const;
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(input: OperationInputFor<'marketing.campaigns.revise'>, context: WriteHandlerContext<'marketing.campaigns.revise'>): Promise<OperationReply<OperationOutputFor<'marketing.campaigns.revise'>>> {
    const access = requireSession(context.security);
    const campaign = await this.campaigns.revise(context.transaction, access.scope.id, input.path.campaignid, context.expectedVersion!, campaignRevision(bodyRecord(input), access.actor.id));
    if (!campaign) throw new DomainError('VERSION_CONFLICT');
    return {
      status: 200,
      body: campaign as unknown as OperationOutputFor<'marketing.campaigns.revise'>,
      events: [campaignEvent('marketing.campaign.revised', { id: campaign.id, scope: campaign.scope_id, state: campaign.state, version: campaign.version }, { actor: access.actor.id, trace: context.traceId })],
    };
  }
}
