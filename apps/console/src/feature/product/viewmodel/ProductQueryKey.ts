import { OP_CATALOG_LISTINGS_READ, OP_CATALOG_POOLS_READ, OP_CATALOG_PRODUCT_DETAIL_READ } from '@shop/contract/ids';
import { CONTRACT_CHECKSUM } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductQuery } from '../public';

export const productKey = (context: ConsoleContext, filter: ProductQuery) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, OP_CATALOG_LISTINGS_READ, filter] as const);
export const productDetailKey = (context: ConsoleContext, productid: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, OP_CATALOG_PRODUCT_DETAIL_READ, productid] as const);
export const poolKey = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, OP_CATALOG_POOLS_READ, Object.freeze({ limit: 100 })] as const);
