export const EXPORT_REPORTS = Object.freeze(['metrics', 'orders', 'finance.statement'] as const);
export type ExportReport = typeof EXPORT_REPORTS[number];
export type ExportState = 'queued' | 'running' | 'completed' | 'failed' | 'expired';

export interface ExportJob {
  readonly id: string;
  readonly scope: string;
  readonly report: ExportReport;
  readonly filter: Readonly<Record<string, unknown>>;
  readonly state: ExportState;
  readonly cursor: string | null;
  readonly recordCount: number;
  readonly objectReference: string | null;
  readonly objectHash: string | null;
  readonly objectSize: number | null;
  readonly scanState: 'pending' | 'clean' | 'rejected' | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
  readonly generatedAt: string | null;
  readonly errorCode: string | null;
}

export interface ExportRow {
  readonly key: string;
  readonly values: readonly unknown[];
}

export function exportReport(value: string): ExportReport {
  if (!EXPORT_REPORTS.includes(value as ExportReport)) throw new Error('REPORT_EXPORT_TYPE_UNSUPPORTED');
  return value as ExportReport;
}

export const ORDER_EXPORT_FIELDS = Object.freeze([
  'orderNumber', 'createdAt', 'lifecycleState', 'mallId', 'memberId', 'totalMinor', 'currency', 'paymentState',
  'productNames', 'skus', 'quantityTotal', 'fulfillmentState', 'providers', 'aftersaleState', 'refundMinor',
] as const);
export type OrderExportField = typeof ORDER_EXPORT_FIELDS[number];

const ORDER_EXPORT_LABELS: Readonly<Record<OrderExportField, string>> = Object.freeze({
  orderNumber: '订单号', createdAt: '下单时间', lifecycleState: '订单状态', mallId: '所属商城', memberId: '消费会员',
  totalMinor: '订单金额（分）', currency: '币种', paymentState: '支付状态', productNames: '商品名称', skus: 'SKU',
  quantityTotal: '商品数量', fulfillmentState: '履约状态', providers: '供应渠道', aftersaleState: '售后状态', refundMinor: '退款金额（分）',
});

export function orderExportFields(filter: Readonly<Record<string, unknown>>): readonly OrderExportField[] {
  const requested = Array.isArray(filter.fields) ? filter.fields : [];
  const selected = requested.filter((value): value is OrderExportField => typeof value === 'string' && ORDER_EXPORT_FIELDS.includes(value as OrderExportField));
  return selected.length === 0 ? ORDER_EXPORT_FIELDS.slice(0, 8) : Object.freeze([...new Set(selected)]);
}

export function exportFormat(filter: Readonly<Record<string, unknown>>): 'csv' | 'xlsx' {
  return filter.format === 'xlsx' ? 'xlsx' : 'csv';
}

export function exportHeader(report: ExportReport, filter: Readonly<Record<string, unknown>> = {}): readonly string[] {
  if (report === 'metrics') return Object.freeze(['metricCode','metricVersion','scope','periodFrom','periodTo','timezone','dimensions','value','unit',
    'currency','watermark','projectionVersion','filter','generatedAt']);
  if (report === 'orders') return orderExportFields(filter).map((field) => ORDER_EXPORT_LABELS[field]);
  return Object.freeze(['statementId','periodStart','periodEnd','currency','openingMinor','debitMinor','creditMinor','closingMinor','state']);
}
