import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { ListingPoolRepository } from '../port/ListingRepository';
import { ListingsPoolSetHandler } from './ListingsPoolSetHandler';

describe('ListingsPoolSetHandler', () => {
  it('changes one authorized listing pool with caller identity and version evidence', async () => {
    const record = { id: 'listing:one', scope_id: 'mall:one', pool_id: 'pool:two', sku_id: 'sku:one', title: '办公福利礼盒', status: 'unpublished', effective_at: null, expires_at: null, version: 4, created_at: '2026-09-07T08:00:00.000Z', updated_at: '2026-09-07T08:00:00.000Z' } as const;
    const changePool = vi.fn<ListingPoolRepository['changePool']>(async () => record);
    const transaction = {} as never;
    const context = { ...readHandlerContext('catalog.listings.pool.set', transaction), expectedVersion: 3 } as WriteHandlerContext<'catalog.listings.pool.set'>;
    const reply = await new ListingsPoolSetHandler({ changePool }).execute({ path: { listingid: 'listing:one' }, body: { pool: 'pool:two' } }, context);

    expect(changePool).toHaveBeenCalledWith(transaction, 'listing:one', 'mall:one', 'pool:two', 3);
    expect(OPERATION_SCHEMAS['catalog.listings.pool.set'].output.parse(reply.body)).toEqual(reply.body);
  });

  it('passes null explicitly when removing a listing from its current pool', async () => {
    const record = { id: 'listing:one', scope_id: 'mall:one', pool_id: null, sku_id: 'sku:one', title: '办公福利礼盒', status: 'unpublished', effective_at: null, expires_at: null, version: 5, created_at: '2026-09-07T08:00:00.000Z', updated_at: '2026-09-07T08:00:00.000Z' } as const;
    const changePool = vi.fn<ListingPoolRepository['changePool']>(async () => record);
    const context = { ...readHandlerContext('catalog.listings.pool.set', {} as never), expectedVersion: 4 } as WriteHandlerContext<'catalog.listings.pool.set'>;
    await new ListingsPoolSetHandler({ changePool }).execute({ path: { listingid: 'listing:one' }, body: { pool: null } }, context);
    expect(changePool).toHaveBeenCalledWith(expect.anything(), 'listing:one', 'mall:one', null, 4);
  });
});
