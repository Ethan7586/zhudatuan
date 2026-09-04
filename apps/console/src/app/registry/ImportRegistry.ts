import { RUNTIME_IMPORT_OWNERS, type OperationId } from '@shop/contract';
import {
  OP_CATALOG_IMPORTS_CREATE,
  OP_FINANCE_STATEMENTIMPORTS_CREATE,
  OP_INVENTORY_IMPORTS_CREATE,
  OP_MEMBER_IMPORTS_CREATE,
  OP_ORDER_IMPORTS_CREATE,
  OP_VOUCHER_CREDENTIALS_IMPORT,
} from '@shop/contract/ids';
import { createRegistry, type RegistryPort } from './Registry';
import { STATEMENT_IMPORT_TEMPLATE } from '../../shared/import/StatementImport';

export type ImportOwner = (typeof RUNTIME_IMPORT_OWNERS)[number];

export interface ImportRegistration {
  readonly id: ImportOwner;
  readonly kind: string;
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly operation: OperationId;
}

export type ImportRegistryPort = RegistryPort<ImportOwner, ImportRegistration>;

const ENTRIES: readonly ImportRegistration[] = Object.freeze([
  Object.freeze({ id: 'member', kind: 'member', title: '成员', description: '校验手机号、外部编号、组织路径与重复身份。', columns: Object.freeze(['displayName', 'employeeNo', 'client']), operation: OP_MEMBER_IMPORTS_CREATE }),
  Object.freeze({ id: 'catalog', kind: 'product', title: '商品', description: '校验类目、SPU/SKU、供应商、图片和必填属性。', columns: Object.freeze(['spu', 'title', 'sku', 'category', 'supplier', 'type', 'images', 'attributes', 'specifications']), operation: OP_CATALOG_IMPORTS_CREATE }),
  Object.freeze({ id: 'inventory', kind: 'stock', title: '库存', description: '校验 SKU、仓库或门店、数量与时间水位。', columns: Object.freeze(['sku', 'location', 'onhand', 'safety', 'status']), operation: OP_INVENTORY_IMPORTS_CREATE }),
  Object.freeze({ id: 'voucher', kind: 'credential', title: '卡券凭证', description: '校验卡号库、密文格式与重复指纹；敏感值不会回显。', columns: Object.freeze(['number', 'secret']), operation: OP_VOUCHER_CREDENTIALS_IMPORT }),
  Object.freeze({ id: 'finance', kind: 'statement', title: '财务账单', description: '只创建账单并触发对账，不导入账本分录或修改余额。', columns: STATEMENT_IMPORT_TEMPLATE.columns, operation: OP_FINANCE_STATEMENTIMPORTS_CREATE }),
  Object.freeze({ id: 'order', kind: 'externalorder', title: '外部订单', description: '校验来源证明、去重键、金额分解和支付事实引用。', columns: Object.freeze(['source', 'externalOrderNo', 'mall', 'member', 'orderedAt', 'currency', 'state', 'totalMinor', 'paymentReference', 'statementReference', 'listing', 'sku', 'title', 'quantity', 'unitMinor', 'discountMinor', 'product', 'productType', 'category', 'provider', 'partner', 'address']), operation: OP_ORDER_IMPORTS_CREATE }),
]);

export function createImportRegistry(): ImportRegistryPort {
  return createRegistry(ENTRIES, RUNTIME_IMPORT_OWNERS, 'IMPORT');
}
