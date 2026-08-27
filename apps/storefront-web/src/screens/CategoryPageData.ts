import type { Product, ProductItemType } from '../types';
import { CATEGORY_DISPLAY_NAMES, TAXONOMY_LEAF_NAMES } from '../domain/catalog/taxonomy';

type TaxonomyLevel = 'l1' | 'l2' | 'l3';

export function getTaxonomyLabel(value: string, optionsType: TaxonomyLevel) {
  if (value === 'all') {
    return '全部';
  }
  if (optionsType === 'l1') {
    return CATEGORY_DISPLAY_NAMES[value] ?? value.replace(/_/g, '/');
  }
  return TAXONOMY_LEAF_NAMES[value] ?? value.replace(/_/g, '/');
}

export type ItemTypeOption = {
  id: ProductItemType | 'all';
  label: string;
};

export function buildTaxonomyOptions(codes: string[], optionsType: TaxonomyLevel) {
  return codes.map((code) => ({
    code,
    label: getTaxonomyLabel(code, optionsType),
  }));
}

export function buildItemTypeOptions(products: Product[]) {
  const options: ItemTypeOption[] = [
    { id: 'all', label: '全部形态' },
    { id: 'physical', label: '实物快递' },
    { id: 'movie_ticket', label: '电影票通兑' },
    { id: 'virtual_coupon', label: '虚拟卡券' },
    { id: 'supermarket', label: '商超好卡' },
    { id: 'nearby_store', label: '附近门店核销' },
    { id: 'life_service', label: '生活服务' },
  ];

  return options.filter((option) => option.id === 'all' || products.some((product) => product.itemType === option.id));
}
