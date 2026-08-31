import catalogTaxonomy from '@shop/contract/catalog-taxonomy.json';

export interface TaxonomyNode {
  readonly code: string;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly children?: readonly TaxonomyNode[];
}
interface CatalogLeaf {
  readonly code: string;
  readonly nameZh: string;
  readonly l1: string;
  readonly l2: string;
}

export const SMART_WING_TAXONOMY = catalogTaxonomy.categories as readonly TaxonomyNode[];
export const CATEGORY_DISPLAY_NAMES = Object.freeze(Object.fromEntries(SMART_WING_TAXONOMY.map(({ code, nameZh }) => [code, nameZh])));
export const TAXONOMY_LEAF_NAMES: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries((catalogTaxonomy.leaves as CatalogLeaf[]).map(({ code, nameZh }) => [code, nameZh])));
export const STRICT_TAXONOMY_PATHS: Readonly<Record<string, readonly [string, string]>> = Object.freeze(Object.fromEntries((catalogTaxonomy.leaves as CatalogLeaf[]).map(({ code, l1, l2 }) => [code, [l1, l2] as const])));

export function isStrictTaxonomyPath(l1: string | null, l2: string | null, l3: string | null): boolean {
  if (!l1 || !l2 || !l3) return false;
  const path = STRICT_TAXONOMY_PATHS[l3];
  return Boolean(path && path[0] === l1 && path[1] === l2);
}
