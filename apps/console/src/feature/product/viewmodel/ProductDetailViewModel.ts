import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductDetail, ProductDetailSection } from '../model/Product';
import { productDetailKey } from './ProductQueryKey';

type Dependency = keyof ProductDetail['dependencies'];

export function useProductDetailViewModel(productid: string, context: ConsoleContext, dependencies: ProductDependencies) {
  const request = Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
  const core = useSection(productid, 'core', 'catalog', context, dependencies, request);
  const pricing = useSection(productid, 'pricing', 'pricing', context, dependencies, request);
  const inventory = useSection(productid, 'inventory', 'inventory', context, dependencies, request);
  const qualification = useSection(productid, 'qualification', 'qualification', context, dependencies, request);
  return Object.freeze({
    data: core.data,
    condition: core.condition,
    ...(core.error === undefined ? {} : { error: core.error }),
    sections: Object.freeze({ core, pricing, inventory, qualification }),
    refresh: () => {
      core.refresh();
      pricing.refresh();
      inventory.refresh();
      qualification.refresh();
    },
  });
}

function useSection(productid: string, section: ProductDetailSection, dependency: Dependency, context: ConsoleContext, dependencies: ProductDependencies, request: Parameters<ProductDependencies['readProduct']['execute']>[0]) {
  const query = useQuery({
    queryKey: productDetailKey(context, productid, section),
    queryFn: ({ signal }) => dependencies.readProduct.execute(request, productid, section, signal),
    enabled: productid !== '',
    staleTime: 60_000,
  });
  const queryError = safeQueryError(query.error);
  const unavailable = query.data?.dependencies[dependency].state === 'unavailable';
  const error = queryError ?? (unavailable ? dependencyError(dependency) : undefined);
  const condition =
    productid === '' ? ('empty' as const) : unavailable ? ('unavailable' as const) : queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: false });
  return Object.freeze({
    section,
    data: query.data as ProductDetail | undefined,
    condition,
    ...(error === undefined ? {} : { error }),
    refresh: () => void query.refetch(),
  });
}

function dependencyError(dependency: Dependency): string {
  return {
    catalog: '商品主档暂时不可用，请重试。',
    pricing: '报价服务暂时不可用；其他商品信息仍可查看。',
    inventory: '库存服务暂时不可用；其他商品信息仍可查看。',
    qualification: '资格服务暂时不可用；其他商品信息仍可查看。',
  }[dependency];
}

export type ProductDetailSectionViewModel = ReturnType<typeof useSection>;
export type ProductDetailViewModel = ReturnType<typeof useProductDetailViewModel>;
