import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CampaignRepository } from '../port/CampaignRepository';

export class CampaignsReadHandler implements OperationHandler<'marketing.campaigns.read', 'read'> {
  readonly operation = 'marketing.campaigns.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly campaigns: CampaignRepository) {}

  async execute(input: OperationInputFor<'marketing.campaigns.read'>, context: HandlerContext<'marketing.campaigns.read'>): Promise<OperationReply<OperationOutputFor<'marketing.campaigns.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.campaigns.read(context.transaction, access.scope.id, page);
    const result = keysetPage(rows, page, 'updated_at');
    return { status: 200, body: { ...result, items: [...result.items] } as unknown as OperationOutputFor<'marketing.campaigns.read'> };
  }
}
