import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { CampaignSnapshot } from '../model/Campaign';

type CampaignEvent = 'marketing.campaign.created' | 'marketing.campaign.revised' | 'marketing.campaign.published' | 'marketing.campaign.disabled';

export function campaignEvent(type: CampaignEvent, campaign: Pick<CampaignSnapshot, 'id' | 'scope' | 'state' | 'version'>, metadata: Readonly<{ actor: string; trace: string }>): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
    tenant: campaign.scope,
    actor: metadata.actor,
    trace: metadata.trace,
    occurred: new Date().toISOString(),
    payload: { campaign: campaign.id, scope: campaign.scope, state: campaign.state, version: campaign.version },
  });
}
