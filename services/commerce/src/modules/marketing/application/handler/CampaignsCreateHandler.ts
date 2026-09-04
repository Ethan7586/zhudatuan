import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { campaignEvent } from '../../domain/event/MarketingEvents';
import { campaignRevision } from '../model/CampaignInput';
import type { CampaignRepository } from '../port/CampaignRepository';

export class CampaignsCreateHandler implements OperationHandler<'marketing.campaigns.create', 'write'> {
  readonly operation = 'marketing.campaigns.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(input: OperationInputFor<'marketing.campaigns.create'>, context: WriteHandlerContext<'marketing.campaigns.create'>): Promise<OperationReply<OperationOutputFor<'marketing.campaigns.create'>>> {
    const access = requireSession(context.security);
    const campaign = await this.campaigns.create(context.transaction, {
      id: `campaign:${randomUUID()}`,
      scope: access.scope.id,
      revision: campaignRevision(bodyRecord(input), access.actor.id),
      actor: access.actor.id,
    });
    return { status: 201, body: campaign as unknown as OperationOutputFor<'marketing.campaigns.create'>, events: [campaignEvent('marketing.campaign.created', snapshot(campaign), { actor: access.actor.id, trace: context.traceId })] };
  }
}

function snapshot(value: Awaited<ReturnType<CampaignRepository['create']>>): Parameters<typeof campaignEvent>[1] {
  return { id: value.id, scope: value.scope_id, state: value.state, version: value.version };
}
