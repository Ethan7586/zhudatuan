import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { ListingPublication } from '../service/ListingPublication';
import { ListingsBatchHandler } from './ListingsBatchHandler';

describe('ListingsBatchHandler', () => {
  it('routes preview and hash-bound execution through one authoritative operation', async () => {
    const preview = vi.fn(async () => result('ready'));
    const execute = vi.fn(async () => result('succeeded'));
    const transaction = {} as never;
    const context = readHandlerContext('catalog.listings.batch', transaction) as WriteHandlerContext<'catalog.listings.batch'>;
    const handler = new ListingsBatchHandler({ preview, execute } as unknown as ListingPublication);
    const items = [{ id: 'listing:one', expectedVersion: 3 }];

    const preflight = await handler.execute({ body: { phase: 'preview', action: 'publish', items } }, context);
    const receipt = await handler.execute({ body: { phase: 'execute', action: 'publish', items, previewHash: 'a'.repeat(64) } }, context);

    expect(preview).toHaveBeenCalledWith(transaction, 'mall:one', items, 'publish');
    expect(execute).toHaveBeenCalledWith(transaction, 'mall:one', items, 'publish', 'a'.repeat(64), expect.any(String), context.traceId);
    expect(OPERATION_SCHEMAS['catalog.listings.batch'].output.parse(preflight.body)).toEqual(preflight.body);
    expect(OPERATION_SCHEMAS['catalog.listings.batch'].output.parse(receipt.body)).toEqual(receipt.body);
  });

  it('rejects duplicate targets and malformed execution hashes before domain work', async () => {
    const publication = { preview: vi.fn(), execute: vi.fn() } as unknown as ListingPublication;
    const handler = new ListingsBatchHandler(publication);
    const context = readHandlerContext('catalog.listings.batch', {} as never) as WriteHandlerContext<'catalog.listings.batch'>;
    const duplicate = [
      { id: 'listing:one', expectedVersion: 3 },
      { id: 'listing:one', expectedVersion: 3 },
    ];

    await expect(handler.execute({ body: { phase: 'preview', action: 'publish', items: duplicate } }, context)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(handler.execute({ body: { phase: 'execute', action: 'publish', items: duplicate.slice(0, 1), previewHash: 'invalid' } } as never, context)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(publication.preview).not.toHaveBeenCalled();
    expect(publication.execute).not.toHaveBeenCalled();
  });
});

function result(state: 'ready' | 'succeeded') {
  return Object.freeze({
    previewHash: 'a'.repeat(64),
    items: Object.freeze([{ id: 'listing:one', state, status: 'published' as const, version: state === 'ready' ? 3 : 4, error: null, gaps: Object.freeze([]) }]),
    records: Object.freeze([]),
    events: Object.freeze([]),
  });
}
