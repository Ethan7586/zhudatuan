import { createFetchCatalog } from '@shop/sdk/catalog';
import { createFetchPricing } from '@shop/sdk/pricing';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import type { Listing, Pool } from './ProductSchema';

const catalog = createFetchCatalog(appConfig.apiBaseUrl);
const pricing = createFetchPricing(appConfig.apiBaseUrl);

export interface ProductDraft {
  readonly title: string;
  readonly category: string;
  readonly type: 'physical' | 'virtual' | 'service' | 'voucher';
}

export async function createProduct(context: ConsoleContext, draft: ProductDraft) {
  return catalog.productsCreate({ body: { title: draft.title, category: draft.category, type: draft.type } }, command(context));
}

export async function updateProduct(context: ConsoleContext, listing: Listing, draft: Readonly<{ title: string; category: string; status: 'draft' | 'review' | 'active' | 'archived' }>) {
  const detail = await productDetail(context, listing.product_id);
  return catalog.productsUpdate({ path: { productid: listing.product_id }, body: draft }, command(context, version(detail.version)));
}

export async function archiveProduct(context: ConsoleContext, listing: Listing) {
  const detail = await productDetail(context, listing.product_id);
  return catalog.productsArchive({ path: { productid: listing.product_id }, body: {} }, command(context, version(detail.version)));
}

export async function setListingPublication(context: ConsoleContext, listing: Listing, published: boolean) {
  const input = { path: { listingid: listing.id }, body: {} } as const;
  return published ? catalog.listingsPublish(input, command(context, version(listing.version))) : catalog.listingsUnpublish(input, command(context, version(listing.version)));
}

export async function setListingsPublication(context: ConsoleContext, ids: readonly string[], published: boolean) {
  return catalog.listingsBatch({ body: { ids: [...ids], action: published ? 'publish' : 'unpublish' } }, command(context));
}

export async function publishPrice(context: ConsoleContext, listing: Listing, amountMinor: number) {
  const created = await pricing.rulesCreate(
    {
      body: {
        priority: 100,
        kind: 'fixed',
        condition: { listingId: listing.id, productId: listing.product_id, skuId: listing.sku_id },
        effect: { amountMinor, currency: 'CNY', mode: 'fixed' },
      },
    },
    command(context)
  );
  return pricing.rulesPublish({ path: { ruleid: created.id }, body: {} }, command(context, version(created.version)));
}

export async function allocatePool(context: ConsoleContext, source: Pool, targetScope: string, kind: 'channel' | 'markup', name: string) {
  return catalog.poolsAllocate({ path: { poolid: source.id }, body: { scope: targetScope, kind, name } }, command(context));
}

export async function setPoolBinding(context: ConsoleContext, pool: Pool, mallScope: string, attached: boolean) {
  const input = { path: { poolid: pool.id, scopeid: mallScope }, body: {} } as const;
  return attached ? catalog.poolsAttach(input, command(context, version(pool.version))) : catalog.poolsDetach(input, command(context, version(pool.version)));
}

function productDetail(context: ConsoleContext, productId: string) {
  return catalog.productDetailRead({ path: { productid: productId } }, consoleRequest(context.scope, undefined, context.session.accessVersion));
}

function command(context: ConsoleContext, expectedVersion?: number) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
  });
}

function version(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('INVALID_RESOURCE_VERSION');
  return parsed;
}
