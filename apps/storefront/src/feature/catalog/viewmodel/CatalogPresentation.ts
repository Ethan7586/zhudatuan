import { presentProduct, type PresentedProduct, type Product } from '../../../entity/product';
import type { CatalogCategory } from '../model/CatalogCategory';
import type { CatalogPage } from '../model/CatalogPage';

export type FrontendProduct = PresentedProduct;
export type FrontendCategory = CatalogCategory;

export function toFrontendProducts(products: readonly Product[]): readonly FrontendProduct[] {
  return Object.freeze(products.map(presentProduct));
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

export function toFrontendCategories(categories: CatalogPage['categories']): readonly FrontendCategory[] {
  return Object.freeze(
    categories.map((category) => Object.freeze({ ...category, iconName: CATEGORY_ICONS[category.code] ?? 'Gift', description: `${category.count} 件可见商品` }))
  );
}
