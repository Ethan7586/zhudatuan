import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { PublicCatalogHttpHandler } from './PublicCatalogHttpHandler';

describe('public catalog HTTP handler', () => {
  it('returns published products without a session and keeps purchasing locked until login', async () => {
    const query = vi.fn(async () => result([{
      id: 'listing:one', sku_id: 'sku:one', name: '主打团货盘', subtitle: '支付闭环验证商品', product_type: 'physical',
      cover_url: null, amount_minor: '1', compare_minor: null, available_stock: '10', supplier_name: '平台自营', is_test: false,
    }]));
    const next = { handle: vi.fn(async () => new Response(null, { status: 404 })) };
    const handler = new PublicCatalogHttpHandler(next, pool(query), 'zdt-l1-verify', ['https://hbbtzn.com']);

    const response = await handler.handle(new Request('https://hbbtzn.com/api/v1/catalog/public/products', {
      headers: { origin: 'https://hbbtzn.com' },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ name: '主打团货盘', priceCents: 1, availableStock: 10, purchasable: false,
        qualification: { visible: true, purchaseReason: 'LOGIN_REQUIRED' } }],
      access: { mode: 'public' },
    });
    expect(query).toHaveBeenCalledWith('select * from catalog.public_storefront_catalog($1,$2,$3,$4)',
      ['zdt-l1-verify', 24, 0, null]);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('delegates every non-public route to the canonical application', async () => {
    const next = { handle: vi.fn(async () => new Response(null, { status: 418 })) };
    const handler = new PublicCatalogHttpHandler(next, pool(vi.fn()), 'zdt-l1-verify', []);
    const response = await handler.handle(new Request('https://api.zhudatuan.com/api/v1/catalog/listings'));
    expect(response.status).toBe(418);
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('binds the public catalog to one application and one mall scope', async () => {
    const query = vi.fn(async (text: string) => text.includes('select exists')
      ? result([{ bound: true }])
      : result([]));
    const handler = new PublicCatalogHttpHandler(
      { handle: vi.fn(async () => new Response(null, { status: 404 })) },
      pool(query),
      'zdt-l1-verify',
      ['https://hbbtzn.com'],
      'mall:hongtai',
    );

    const crossNode = await handler.handle(new Request(
      'https://hbbtzn.com/api/v1/catalog/public/products?mall=zhudatuan-storefront',
      { headers: { origin: 'https://hbbtzn.com' } },
    ));
    expect(crossNode.status).toBe(404);
    expect(query).not.toHaveBeenCalled();

    const ownNode = await handler.handle(new Request('https://hbbtzn.com/api/v1/catalog/public/products', {
      headers: { origin: 'https://hbbtzn.com' },
    }));
    expect(ownNode.status).toBe(200);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('public_slug=$1 and scope_id=$2'),
      ['zdt-l1-verify', 'mall:hongtai']);
  });
});

function pool(query: ReturnType<typeof vi.fn>): DatabasePool {
  const value = {
    connect: vi.fn(async () => ({} as PoolClient)),
    query,
    workload: vi.fn(() => value),
    end: vi.fn(async () => undefined),
  };
  return value as unknown as DatabasePool;
}

function result(rows: Record<string, unknown>[]): QueryResult<Record<string, unknown>> {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
}
