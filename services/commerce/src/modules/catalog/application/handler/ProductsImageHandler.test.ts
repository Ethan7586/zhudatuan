import { describe, expect, it, vi } from 'vitest';
import { readHandlerContext } from '../../../../test/HandlerFixture';
import type { ProductRepository } from '../port/ProductRepository';
import { ProductsCreateHandler } from './ProductsCreateHandler';
import { ProductsUpdateHandler } from './ProductsUpdateHandler';

describe('product image commands', () => {
  it('persists only the server-verified object reference and hides it from the command response', async () => {
    const create = vi.fn(async (_context, input) => record(input.attributes));
    const verify = vi.fn(async () => 'object:verified');
    const handler = new ProductsCreateHandler({ create } as unknown as ProductRepository, { verify } as never);

    const reply = await handler.execute({ body: { title: '节日礼盒', category: 'category:festival', attributes: { coverObject: 'object:forged', subtitle: '节日限定' }, image } } as never, writeContext('catalog.products.create') as never);

    expect(verify).toHaveBeenCalledExactlyOnceWith(image);
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ attributes: { coverObject: 'object:verified', subtitle: '节日限定' } }));
    expect(reply.body.attributes).toEqual({ subtitle: '节日限定' });
  });

  it('uses explicit null to remove an existing image without calling an upload service', async () => {
    const update = vi.fn(async () => record({}));
    const verify = vi.fn(async (value) => value);
    const handler = new ProductsUpdateHandler({ update } as unknown as ProductRepository, { verify } as never);

    await handler.execute({ path: { productid: 'product:one' }, body: { image: null } } as never, writeContext('catalog.products.update') as never);

    expect(verify).toHaveBeenCalledExactlyOnceWith(null);
    expect(update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'product:one', coverObject: null, expectedVersion: 3 }));
  });
});

const image = Object.freeze({
  reference: 'object:cover',
  path: 'tenant/owner/asset/2030/01/01/cover.png',
  sha256: 'a'.repeat(64),
  size: 8,
  contentType: 'image/png' as const,
  retentionUntil: '2030-12-31T00:00:00.000Z',
});

function writeContext(operation: 'catalog.products.create' | 'catalog.products.update') {
  return { ...readHandlerContext(operation, {} as never), expectedVersion: 3, idempotencyKey: `command:${operation}` };
}

function record(attributes: Readonly<Record<string, unknown>>) {
  return {
    id: 'product:one',
    scope_id: 'mall:one',
    owner_partner_id: null,
    brand_id: null,
    category_id: 'category:festival',
    title: '节日礼盒',
    product_type: 'physical',
    attributes,
    status: 'draft',
    version: 1,
    created_at: '2030-01-01T00:00:00.000Z',
    updated_at: '2030-01-01T00:00:00.000Z',
  };
}
