import type { ListingPage } from '../product/ProductSchema';

export interface SupplyPartnerSummary {
  readonly id: string;
  readonly name: string;
  readonly productCount: number;
  readonly lastSyncedAt?: string;
}

export function supplyPartnersFromListingPage(page: ListingPage | undefined): readonly SupplyPartnerSummary[] {
  if (page === undefined) return [];
  const partners = new Map<string, SupplyPartnerSummary>();

  for (const facet of page.preview?.facets.suppliers ?? []) {
    partners.set(facet.value, { id: facet.value, name: facet.label, productCount: facet.count });
  }

  for (const listing of page.items) {
    const preview = listing.preview;
    if (preview === undefined) continue;
    const current = partners.get(preview.supplier.id);
    partners.set(preview.supplier.id, {
      id: preview.supplier.id,
      name: preview.supplier.name,
      productCount: current?.productCount ?? 1,
      lastSyncedAt: latestTimestamp(current?.lastSyncedAt, preview.lastSyncedAt),
    });
  }

  return Object.freeze([...partners.values()].sort((left, right) => right.productCount - left.productCount
    || left.name.localeCompare(right.name, 'zh-CN')));
}

function latestTimestamp(left: string | undefined, right: string): string {
  if (left === undefined) return right;
  return Date.parse(right) > Date.parse(left) ? right : left;
}
