import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { CategoryRepository } from '../port/CategoryRepository';
import { CategoriesCreateHandler } from './CategoriesCreateHandler';
import { CategoriesReadHandler } from './CategoriesReadHandler';

describe('category handlers', () => {
  it('returns searchable category choices without leaking persistence details', async () => {
    const read = vi.fn<CategoryRepository['read']>(async () => [category]);
    const reply = await new CategoriesReadHandler({ read } as Pick<CategoryRepository, 'read'> as CategoryRepository).execute(
      { query: { q: ' 餐食 ', limit: 20 } } as never,
      readHandlerContext('catalog.categories.read', {} as never)
    );

    expect(read).toHaveBeenCalledWith(expect.anything(), '餐食', expect.objectContaining({ limit: 20, fetch: 21 }));
    expect(reply).toEqual({ status: 200, body: { items: [category], count: 1 } });
  });

  it('creates a category only from the platform scope', async () => {
    const create = vi.fn<CategoryRepository['create']>(async () => category);
    const context = platformContext('catalog.categories.create');
    const reply = await new CategoriesCreateHandler({ create } as Pick<CategoryRepository, 'create'> as CategoryRepository).execute(
      { body: { name: ' 餐食 ', parent: null, sort: 10 } } as never,
      context as never
    );

    expect(create).toHaveBeenCalledWith(expect.anything(), { name: '餐食', parent: null, sort: 10 });
    expect(reply).toEqual({ status: 201, body: category });
  });

  it('rejects category creation outside the platform scope', async () => {
    const create = vi.fn<CategoryRepository['create']>();
    const handler = new CategoriesCreateHandler({ create } as Pick<CategoryRepository, 'create'> as CategoryRepository);

    await expect(handler.execute({ body: { name: '餐食' } } as never, readHandlerContext('catalog.categories.create', {} as never) as never)).rejects.toMatchObject({ code: 'SCOPE_DENIED' });
    expect(create).not.toHaveBeenCalled();
  });
});

const category = Object.freeze({
  id: 'category:meal',
  parent_id: null,
  parent_name: null,
  code: 'MEAL',
  name: '餐食',
  status: 'active' as const,
  sort_order: 10,
  product_count: 3,
});

function platformContext(operation: 'catalog.categories.create') {
  const context = readHandlerContext(operation, {} as never, 'platform:shop');
  return {
    ...context,
    expectedVersion: null,
    idempotencyKey: 'command:category:create',
    security: {
      ...context.security,
      access: context.security.kind === 'session' ? { ...context.security.access, scope: { id: 'platform:shop', kind: 'platform' as const, path: [] } } : null,
    },
  };
}
