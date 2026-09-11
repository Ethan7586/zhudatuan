import type { ListingPage } from '../product/ProductSchema';

export interface SupplyPartnerSummary {
  readonly id: string;
  readonly name: string;
  readonly productCount: number;
  readonly skuCount: number;
  readonly trialProductCount: number;
  readonly publishedCount: number;
  readonly availableStock: number;
  readonly inventoryValueMinor: number;
  readonly minPriceMinor: number | null;
  readonly maxPriceMinor: number | null;
  readonly channel: string;
  readonly settlementMode: string;
  readonly agreementStatus: string;
  readonly contractRef?: string;
  readonly capabilities: readonly string[];
  readonly effectiveAt?: string;
  readonly lastSyncedAt?: string;
}

export function supplyPartnersFromListingPage(page: ListingPage | undefined): readonly SupplyPartnerSummary[] {
  if (page === undefined) return [];
  const partners = new Map<string, SupplyPartnerSummary>();

  for (const facet of page.preview?.facets.suppliers ?? []) {
    partners.set(facet.value, {
      id: facet.value,
      name: facet.label,
      productCount: facet.productCount ?? facet.count,
      skuCount: facet.skuCount ?? facet.count,
      trialProductCount: facet.trialProductCount ?? 0,
      publishedCount: facet.publishedCount ?? 0,
      availableStock: facet.availableStock ?? 0,
      inventoryValueMinor: facet.inventoryValueMinor ?? 0,
      minPriceMinor: facet.minPriceMinor ?? null,
      maxPriceMinor: facet.maxPriceMinor ?? null,
      channel: facet.channel ?? '供应商直供',
      settlementMode: facet.settlementMode ?? '按协议结算',
      agreementStatus: facet.agreementStatus ?? 'draft',
      ...(facet.contractRef == null ? {} : { contractRef: facet.contractRef }),
      capabilities: facet.capabilities ?? [],
      ...(facet.effectiveAt == null ? {} : { effectiveAt: facet.effectiveAt }),
      ...(facet.lastSyncedAt == null ? {} : { lastSyncedAt: facet.lastSyncedAt }),
    });
  }

  for (const listing of page.items) {
    const preview = listing.preview;
    if (preview === undefined) continue;
    const current = partners.get(preview.supplier.id);
    partners.set(preview.supplier.id, {
      id: preview.supplier.id,
      name: preview.supplier.name,
      productCount: current?.productCount ?? 1,
      skuCount: current?.skuCount ?? preview.skuTotal,
      trialProductCount: current?.trialProductCount ?? 0,
      publishedCount: current?.publishedCount ?? 0,
      availableStock: current?.availableStock ?? preview.inventory ?? 0,
      inventoryValueMinor: current?.inventoryValueMinor ?? 0,
      minPriceMinor: current?.minPriceMinor ?? preview.priceCents,
      maxPriceMinor: current?.maxPriceMinor ?? preview.priceCents,
      channel: current?.channel ?? '供应商直供',
      settlementMode: current?.settlementMode ?? '按协议结算',
      agreementStatus: current?.agreementStatus ?? 'draft',
      ...(current?.contractRef === undefined ? {} : { contractRef: current.contractRef }),
      capabilities: current?.capabilities ?? [],
      ...(current?.effectiveAt === undefined ? {} : { effectiveAt: current.effectiveAt }),
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
