import { chineseReference, presentProductStatus } from '@shop/presentation';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductFacets } from '../model/Product';
import type { ProductFilterFacets } from '../model/ProductFacet';

export function normalizeProductFacets(value: ProductFacets | undefined, context: ConsoleContext): ProductFilterFacets | undefined {
  if (value === undefined) return undefined;
  const scopes = new Map(context.scopes.map((scope) => [scope.id, scope.name]));
  const option = (item: ProductFacetsItem, label: string) => Object.freeze({ value: item.value, label, count: item.count });
  return Object.freeze({
    categories: Object.freeze(value.categories.map((item) => option(item, item.label ?? chineseReference('分类', item.value)))),
    suppliers: Object.freeze(value.suppliers.map((item) => option(item, item.label ?? '未命名供应商'))),
    malls: Object.freeze(value.malls.map((item) => option(item, item.label ?? scopes.get(item.value) ?? chineseReference('商城', item.value)))),
    statuses: Object.freeze(value.statuses.map((item) => option(item, presentProductStatus(item.value).label))),
  });
}

type ProductFacetsItem = ProductFacets['categories'][number];
