import catalogTaxonomy from '@smart-wing/api-contract/catalog-taxonomy.json';

export type TaxonomyNode = {
  code: string;
  nameZh: string;
  nameEn: string;
  children?: TaxonomyNode[];
};

type CatalogLeaf = {
  code: string;
  nameZh: string;
  l1: string;
  l2: string;
};

/**
 * One machine-readable taxonomy now feeds the Web storefront and the generated
 * native mini-program catalog. Supplier labels never become public navigation
 * until they are mapped into this contract.
 */
export const SMART_WING_TAXONOMY = catalogTaxonomy.categories as TaxonomyNode[];

export const CATEGORY_DISPLAY_NAMES = Object.fromEntries(SMART_WING_TAXONOMY.map(({ code, nameZh }) => [code, nameZh]));

export const TAXONOMY_LEAF_NAMES: Record<string, string> = Object.fromEntries((catalogTaxonomy.leaves as CatalogLeaf[]).map(({ code, nameZh }) => [code, nameZh]));

/** 仅此映射可进入商城公开目录；展示翻译不能改变分类路径。 */
export const STRICT_TAXONOMY_PATHS: Record<string, readonly [string, string]> = Object.fromEntries((catalogTaxonomy.leaves as CatalogLeaf[]).map(({ code, l1, l2 }) => [code, [l1, l2] as const]));

export function isStrictTaxonomyPath(l1: string | null, l2: string | null, l3: string | null) {
  if (!l1 || !l2 || !l3) return false;
  const path = STRICT_TAXONOMY_PATHS[l3];
  return Boolean(path && path[0] === l1 && path[1] === l2);
}
