import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { ListingFacetRepository } from '../port/ListingFacetRepository';
import type { CatalogPartnerPort } from '../../../partner/public';
import { FacetsReadHandler } from './FacetsReadHandler';

describe('FacetsReadHandler', () => {
  it('reads only the active scope and returns independent filter sections', async () => {
    const facets = vi.fn<ListingFacetRepository['facets']>(async () => ({
      categories: [{ value: 'category:food', label: '食品', count: 4 }],
      suppliers: [{ value: 'partner:one', label: null, count: 3 }],
      malls: [{ value: 'mall:one', label: null, count: 4 }],
      statuses: [{ value: 'published', label: null, count: 2 }],
    }));
    const partners = { names: vi.fn(async () => new Map([['partner:one', '央企供应链']])) } as Pick<CatalogPartnerPort, 'names'>;
    const reply = await new FacetsReadHandler({ facets }, partners).execute({ query: { q: ' 早餐 ' } } as never, readHandlerContext('catalog.facets.read', {} as never));
    expect(facets).toHaveBeenCalledWith(expect.anything(), { scope: 'mall:one', scopeKind: 'mall', query: '早餐' });
    expect(reply.body).toMatchObject({ categories: [{ label: '食品', count: 4 }], suppliers: [{ value: 'partner:one', label: '央企供应链' }], statuses: [{ value: 'published' }] });
    expect(partners.names).toHaveBeenCalledWith(expect.anything(), ['partner:one']);
  });
});
