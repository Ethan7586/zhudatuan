export type ListingGap = 'PRODUCT_NOT_ACTIVE' | 'SKU_NOT_ACTIVE' | 'POOL_NOT_ACTIVE' | 'POOL_NOT_BOUND' | 'QUALIFICATION_INVALID' | 'PRICE_MISSING' | 'INVENTORY_UNAVAILABLE' | 'CHANNEL_UNAVAILABLE';

export interface ListingEligibilityInput {
  readonly productState: string;
  readonly skuState: string;
  readonly poolReady: boolean;
  readonly scopeReady: boolean;
  readonly qualification: Readonly<{ eligible: boolean; version: number }>;
  readonly price: Readonly<{ eligible: boolean; version: string | null }>;
  readonly inventory: Readonly<{ eligible: boolean; version: number | null }>;
  readonly channelReady: boolean;
}

export interface ListingEligibilityDecision {
  readonly eligible: boolean;
  readonly gaps: readonly ListingGap[];
  readonly dependencies: Readonly<{
    qualificationVersion: number;
    priceVersion: string | null;
    inventoryVersion: number | null;
  }>;
}

export class ListingEligibility {
  decide(input: ListingEligibilityInput): ListingEligibilityDecision {
    const gaps: ListingGap[] = [];
    if (input.productState !== 'active') gaps.push('PRODUCT_NOT_ACTIVE');
    if (input.skuState !== 'active') gaps.push('SKU_NOT_ACTIVE');
    if (!input.poolReady) gaps.push('POOL_NOT_ACTIVE');
    if (!input.scopeReady) gaps.push('POOL_NOT_BOUND');
    if (!input.qualification.eligible) gaps.push('QUALIFICATION_INVALID');
    if (!input.price.eligible) gaps.push('PRICE_MISSING');
    if (!input.inventory.eligible) gaps.push('INVENTORY_UNAVAILABLE');
    if (!input.channelReady) gaps.push('CHANNEL_UNAVAILABLE');
    return Object.freeze({
      eligible: gaps.length === 0,
      gaps: Object.freeze(gaps),
      dependencies: Object.freeze({
        qualificationVersion: input.qualification.version,
        priceVersion: input.price.version,
        inventoryVersion: input.inventory.version,
      }),
    });
  }
}
