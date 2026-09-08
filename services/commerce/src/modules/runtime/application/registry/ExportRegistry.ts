import type { JobKind } from '../../../../pipeline/JobCatalog';

export interface ExportDescriptor {
  readonly owner: 'reporting' | 'voucher';
  readonly kind: string;
  readonly job: Extract<JobKind, 'export' | 'voucherexport'>;
  readonly title: string;
}

const descriptors: readonly ExportDescriptor[] = Object.freeze([
  Object.freeze({ owner: 'reporting', kind: 'report', job: 'export', title: '报表导出' }),
  Object.freeze({ owner: 'voucher', kind: 'credential', job: 'voucherexport', title: '卡券凭证导出' }),
  Object.freeze({ owner: 'voucher', kind: 'issueorder', job: 'voucherexport', title: '发放单导出' }),
  Object.freeze({ owner: 'voucher', kind: 'action', job: 'voucherexport', title: '批量操作结果导出' }),
  Object.freeze({ owner: 'voucher', kind: 'search', job: 'voucherexport', title: '卡券检索结果导出' }),
]);

export class ExportRegistry {
  private readonly values = new Map(descriptors.map((item) => [`${item.owner}:${item.kind}`, item]));

  constructor() {
    if (this.values.size !== descriptors.length) throw new Error('EXPORT_REGISTRY_DUPLICATE');
  }

  get(owner: string, kind: string): ExportDescriptor | null {
    return this.values.get(`${owner}:${kind}`) ?? null;
  }

  title(owner: string, kind: string): string {
    return this.get(owner, kind)?.title ?? '数据导出';
  }

  all(): readonly ExportDescriptor[] {
    return Object.freeze([...this.values.values()]);
  }
}
