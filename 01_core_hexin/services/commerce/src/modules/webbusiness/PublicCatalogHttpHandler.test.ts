import type { PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { ArchBoard } from '@shop/l-kernel/arch';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import { PUBLIC_CATALOG_INTERFACE, PublicCatalogHttpHandler } from './PublicCatalogHttpHandler';

const NODE_ID = 'node:hbbtzn:l1';

describe('public catalog HTTP handler', () => {
  it('returns published products without a session and keeps purchasing locked until login', async () => {
    const query = vi.fn(async () => result([{
      id: 'listing:one', sku_id: 'sku:one', name: '主打团货盘', subtitle: '支付闭环验证商品', product_type: 'physical',
      cover_url: null, amount_minor: '1', compare_minor: null, available_stock: '10', supplier_name: '平台自营', is_test: false,
    }]));
    const next = { handle: vi.fn(async () => new Response(null, { status: 404 })) };
    const handler = new PublicCatalogHttpHandler(next, pool(query), 'zdt-l1-verify', ['https://hbbtzn.com'], {}, connectedArch(), NODE_ID);

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
    const handler = new PublicCatalogHttpHandler(next, pool(vi.fn()), 'zdt-l1-verify', [], {}, connectedArch(), NODE_ID);
    const response = await handler.handle(new Request('https://api.zhudatuan.com/api/v1/catalog/listings'));
    expect(response.status).toBe(418);
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('binds the public catalog to one configured application', async () => {
    const query = vi.fn(async () => result([]));
    const handler = new PublicCatalogHttpHandler(
      { handle: vi.fn(async () => new Response(null, { status: 404 })) },
      pool(query),
      'zdt-l1-verify',
      ['https://hbbtzn.com'],
      {}, connectedArch(), NODE_ID,
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
    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith('select * from catalog.public_storefront_catalog($1,$2,$3,$4)',
      ['zdt-l1-verify', 24, 0, null]);
  });

  it('selects the public application from the request host on a shared web API', async () => {
    const query = vi.fn(async () => result([]));
    const handler = new PublicCatalogHttpHandler(
      { handle: vi.fn(async () => new Response(null, { status: 404 })) },
      pool(query),
      'zhudatuan-storefront',
      ['https://hbbtzn.com'],
      { 'hbbtzn.com': 'zdt-l1-verify' },
      connectedArch(), NODE_ID,
    );

    const response = await handler.handle(new Request(
      'https://hbbtzn.com/api/v1/catalog/public/products?mall=zdt-l1-verify',
      { headers: { origin: 'https://hbbtzn.com' } },
    ));

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith('select * from catalog.public_storefront_catalog($1,$2,$3,$4)',
      ['zdt-l1-verify', 24, 0, null]);
  });

  it('derives sequential hbbtzn H5 applications from their hostnames', async () => {
    const query = vi.fn(async () => result([]));
    const handler = new PublicCatalogHttpHandler(
      { handle: vi.fn(async () => new Response(null, { status: 404 })) },
      pool(query),
      'zdt-l1-verify',
      ['https://h6.hbbtzn.com'],
      { 'h6.hbbtzn.com': 'zdt-l1-verify' },
      connectedArch(), NODE_ID,
    );

    const response = await handler.handle(new Request(
      'https://h6.hbbtzn.com/api/v1/catalog/public/products',
      { headers: { origin: 'https://h6.hbbtzn.com' } },
    ));

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith('select * from catalog.public_storefront_catalog($1,$2,$3,$4)',
      ['h6', 24, 0, null]);
  });

  it('does not query the catalog when its Arch connection is disconnected', async () => {
    const query = vi.fn(async () => result([]));
    const next = { handle: vi.fn(async () => new Response(null, { status: 404 })) };
    const arch = connectedArch();
    arch.setConnected(NODE_ID, PUBLIC_CATALOG_INTERFACE, false);
    const handler = new PublicCatalogHttpHandler(next, pool(query), 'zdt-l1-verify', [], {}, arch, NODE_ID);

    const disconnected = await handler.handle(new Request('https://hbbtzn.com/api/v1/catalog/public/products'));
    expect(disconnected.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();

    arch.setConnected(NODE_ID, PUBLIC_CATALOG_INTERFACE, true);
    const connected = await handler.handle(new Request('https://hbbtzn.com/api/v1/catalog/public/products'));
    expect(connected.status).toBe(200);
    expect(query).toHaveBeenCalledOnce();
  });
});

function connectedArch(): ArchBoard {
  const arch = new ArchBoard();
  arch.mount(NODE_ID, PUBLIC_CATALOG_INTERFACE);
  return arch;
}

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
