import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ListingPublication } from '../service/ListingPublication';

export class ListingsBatchHandler implements OperationHandler<'catalog.listings.batch', 'write'> {
  readonly operation = 'catalog.listings.batch' as const;
  readonly mode = 'write' as const;
  constructor(private readonly publication: ListingPublication) {}
  async execute(input: OperationInputFor<'catalog.listings.batch'>, context: WriteHandlerContext<'catalog.listings.batch'>): Promise<OperationReply<OperationOutputFor<'catalog.listings.batch'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 200) throw new DomainError('VALIDATION_FAILED', { field: 'items' });
    const commands = body.items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof Reflect.get(item, 'id') !== 'string' || !Number.isSafeInteger(Reflect.get(item, 'expectedVersion'))) {
        throw new DomainError('VALIDATION_FAILED', { field: 'items' });
      }
      return Object.freeze({ id: Reflect.get(item, 'id') as string, expectedVersion: Reflect.get(item, 'expectedVersion') as number });
    });
    if (
      new Set(commands.map(({ id }) => id)).size !== commands.length ||
      (body.action !== 'publish' && body.action !== 'unpublish') ||
      (body.phase !== 'preview' && body.phase !== 'execute') ||
      (body.phase === 'execute' && (typeof body.previewHash !== 'string' || !/^[0-9a-f]{64}$/.test(body.previewHash)))
    ) {
      throw new DomainError('VALIDATION_FAILED', { field: 'items' });
    }
    const result =
      body.phase === 'preview'
        ? await this.publication.preview(context.transaction, access.scope.id, commands, body.action)
        : await this.publication.execute(context.transaction, access.scope.id, commands, body.action, String(body.previewHash), access.actor.id, context.traceId);
    const accepted = result.items.filter(({ state }) => (body.phase === 'preview' ? state === 'ready' : state === 'succeeded')).length;
    return {
      status: 200,
      body: {
        phase: body.phase === 'preview' ? 'preview' : 'executed',
        action: body.action,
        previewHash: result.previewHash,
        items: result.items,
        count: accepted,
        failed: result.items.length - accepted,
      } as OperationOutputFor<'catalog.listings.batch'>,
      events: result.events,
    };
  }
}
