import type { OperationOutputFor } from '@shop/contract';
import type { CatalogPage } from '../model/CatalogPage';
import { mapProduct, presentProduct } from '../../../shared/api/ProductMapper';
import type { CategoryView, PresentedProduct, ProductView } from '../../../shared/runtime/StorefrontPort';
import { CATEGORY_DISPLAY_NAMES } from '../model/Taxonomy';

export type FrontendProduct = PresentedProduct;
export type FrontendCategory = CategoryView;

export function mapCatalog(value: OperationOutputFor<'storefront.catalog.read'>): CatalogPage {
  return Object.freeze({
    items: Object.freeze(value.items.map((item) => Object.freeze({ product: mapProduct(item), listingVersion: item.version }))),
    nextCursor: value.nextCursor,
    version: value.version,
    asOf: value.asOf,
  });
}

export const toFrontendProduct = presentProduct;

export function toFrontendProducts(products: readonly ProductView[]): readonly FrontendProduct[] {
  return Object.freeze(products.map(toFrontendProduct));
}

const CATEGORY_ICONS: Readonly<Record<string, string>> = Object.freeze({
  cat_food: 'UtensilsCrossed',
  cat_appliance: 'Tv',
  cat_digital: 'Laptop',
  cat_home: 'Home',
  cat_personal: 'Sparkles',
  cat_movie: 'Film',
  cat_virtual: 'CreditCard',
  cat_supermarket: 'ShoppingBag',
  cat_life: 'Store',
  cat_welfare_zone: 'Gift',
});

export function toFrontendCategories(products: readonly ProductView[]): readonly FrontendCategory[] {
  const categories = new Map<string, { name: string; titles: Set<string>; keywords: Set<string> }>();
  for (const product of products) {
    const category = categories.get(product.categoryId) ?? { name: CATEGORY_DISPLAY_NAMES[product.categoryId] ?? product.categoryName, titles: new Set<string>(), keywords: new Set<string>() };
    category.titles.add(product.title);
    [product.brand, ...product.tags].filter(Boolean).forEach((keyword) => category.keywords.add(keyword));
    categories.set(product.categoryId, category);
  }
  return Object.freeze(
    [...categories.entries()].map(([id, category]) => {
      const hotKeywords = Object.freeze([...category.titles, ...category.keywords].slice(0, 3));
      const iconName = CATEGORY_ICONS[id] ?? 'Gift';
      return Object.freeze({ id, name: category.name, iconName, hotKeywords, children: Object.freeze([]), icon: iconName, description: hotKeywords.join(' · '), subCategories: Object.freeze([]) });
    })
  );
}
