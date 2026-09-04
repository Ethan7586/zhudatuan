import type { OperationId } from '@shop/contract';
import {
  OP_CATALOG_LISTINGS_POOL_SET,
  OP_CATALOG_POOLS_ALLOCATE,
  OP_CATALOG_POOLS_ATTACH,
  OP_CATALOG_POOLS_DETACH,
  OP_CATALOG_POOLS_READ,
  OP_CATALOG_PRODUCTS_CREATE,
} from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';

export function productAccess(context: ConsoleContext) {
  const canOperation = (operation: OperationId) => canUseOperation(context, operation);
  const canCreate = canOperation(OP_CATALOG_PRODUCTS_CREATE);
  const canReadPools = canOperation(OP_CATALOG_POOLS_READ);
  const canManagePools = canReadPools && [OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH].some(canOperation);
  const canMoveListing = canReadPools && canOperation(OP_CATALOG_LISTINGS_POOL_SET);
  return Object.freeze({
    canOperation,
    canCreate,
    createReason: canCreate ? undefined : '当前账号没有新建商品的权限。',
    canManagePools,
    poolReason: canManagePools ? undefined : '当前账号没有商品池管理权限。',
    canMoveListing,
  });
}
