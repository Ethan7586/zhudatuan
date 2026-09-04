import { OperationCatalog, type OperationId } from '@shop/contract';

export interface ImportDescriptor {
  readonly owner: 'member' | 'catalog' | 'inventory' | 'order' | 'voucher' | 'finance';
  readonly kind: string;
  readonly job: 'memberimport' | 'catalogimport' | 'inventoryimport' | 'orderimport' | 'credentialimport' | 'financeimport';
  readonly title: string;
  readonly operation: OperationId;
}

const descriptors: readonly ImportDescriptor[] = Object.freeze([
  Object.freeze({ owner: 'member', kind: 'member', job: 'memberimport', title: '成员导入', operation: 'member.imports.create' }),
  Object.freeze({ owner: 'catalog', kind: 'product', job: 'catalogimport', title: '商品导入', operation: 'catalog.imports.create' }),
  Object.freeze({ owner: 'inventory', kind: 'stock', job: 'inventoryimport', title: '库存导入', operation: 'inventory.imports.create' }),
  Object.freeze({ owner: 'order', kind: 'externalorder', job: 'orderimport', title: '外部订单导入', operation: 'order.imports.create' }),
  Object.freeze({ owner: 'voucher', kind: 'credential', job: 'credentialimport', title: '卡券凭证导入', operation: 'voucher.credentials.import' }),
  Object.freeze({ owner: 'finance', kind: 'statement', job: 'financeimport', title: '财务账单导入', operation: 'finance.statementimports.create' }),
]);

export class ImportRegistry {
  private readonly values = new Map(descriptors.map((item) => [`${item.owner}:${item.kind}`, item]));

  constructor() {
    if (this.values.size !== descriptors.length || new Set(descriptors.map(({ job }) => job)).size !== descriptors.length) throw new Error('IMPORT_REGISTRY_DUPLICATE');
    for (const descriptor of descriptors) {
      if (OperationCatalog.get(descriptor.operation).module !== descriptor.owner) throw new Error(`IMPORT_OPERATION_OWNER_MISMATCH:${descriptor.operation}`);
    }
  }

  get(owner: string, kind: string): ImportDescriptor | null {
    return this.values.get(`${owner}:${kind}`) ?? null;
  }

  title(owner: string, kind: string): string {
    return this.get(owner, kind)?.title ?? '数据导入';
  }

  all(): readonly ImportDescriptor[] {
    return Object.freeze([...this.values.values()]);
  }
}
