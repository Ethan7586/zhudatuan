import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingRepository } from '../port/ListingRepository';

export class ListingsBatchHandler implements OperationHandler<'catalog.listings.batch', 'write'> {
  readonly operation = 'catalog.listings.batch' as const;
  readonly mode = 'write' as const;
  constructor(private readonly listings: ListingRepository) {}
  async execute(input: OperationInputFor<'catalog.listings.batch'>, context: WriteHandlerContext<'catalog.listings.batch'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.batch'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new DomainError('VALIDATION_FAILED', { field: 'ids' });
    const state = body.action === 'publish' ? 'published' : 'unpublished';
    const result = await this.listings.batch(context.transaction, access.scope.id, body.ids as string[], state);
    return { status: 200, body: { items: [...result.rows], count: result.count } as unknown as OperationOutputFor<'catalog.listings.batch'> };
  }
}
