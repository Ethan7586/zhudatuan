import { CONTRACT_CHECKSUM } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductQuery } from '../public';

export const productKey = (context: ConsoleContext, filter: ProductQuery) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, 'catalog.listings.read', filter] as const);
export const productDetailKey = (context: ConsoleContext, productid: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, 'catalog.product.detail.read', productid] as const);
export const poolKey = (context: ConsoleContext) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, CONTRACT_CHECKSUM, 'catalog.pools.read', Object.freeze({ limit: 100 })] as const);
