import { createFetchOrderOrdersExport } from '@shop/sdk/order';
import { createFetchReportingExportsRead } from '@shop/sdk/reporting';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const createExportOperation = createFetchOrderOrdersExport(appConfig.apiBaseUrl);
const readExportOperation = createFetchReportingExportsRead(appConfig.apiBaseUrl);

export const ORDER_EXPORT_FIELDS = Object.freeze([
  ['orderNumber', '订单号', 'order'], ['createdAt', '下单时间', 'order'], ['lifecycleState', '订单状态', 'order'],
  ['mallId', '所属商城', 'order'], ['memberId', '消费会员', 'member'], ['totalMinor', '订单金额', 'finance'],
  ['currency', '币种', 'finance'], ['paymentState', '支付状态', 'finance'], ['productNames', '商品名称', 'product'],
  ['skus', 'SKU', 'product'], ['quantityTotal', '商品数量', 'product'], ['fulfillmentState', '履约状态', 'fulfillment'],
  ['providers', '供应渠道', 'fulfillment'], ['aftersaleState', '售后状态', 'aftersale'], ['refundMinor', '退款金额', 'aftersale'],
] as const);

export type OrderExportField = typeof ORDER_EXPORT_FIELDS[number][0];
export type OrderExportFormat = 'xlsx' | 'csv';
export type OrderExportState = 'queued' | 'running' | 'completed' | 'failed' | 'expired';

export interface OrderExportTask {
  readonly id: string;
  readonly state: OrderExportState;
  readonly recordCount: number;
  readonly createdAt: string;
  readonly generatedAt: string | null;
  readonly errorCode: string | null;
  readonly filter: Readonly<Record<string, unknown>>;
  readonly download?: Readonly<{ url: string; expiresAt?: string }>;
}

export interface OrderExportDraft {
  readonly format: OrderExportFormat;
  readonly filename: string;
  readonly fields: readonly OrderExportField[];
  readonly filter: Readonly<Record<string, unknown>>;
}

export async function createOrderExport(context: ConsoleContext, draft: OrderExportDraft, signal?: AbortSignal): Promise<OrderExportTask> {
  const value = await createExportOperation(
    { body: { ...draft.filter, format: draft.format, filename: draft.filename, fields: draft.fields } },
    consoleCommand(context.scope, { accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }), ...(signal === undefined ? {} : { signal }) }),
  );
  return parseTask(value);
}

export async function readOrderExport(context: ConsoleContext, id: string, signal?: AbortSignal): Promise<OrderExportTask> {
  const value = await readExportOperation(
    { path: { exportid: id } },
    consoleRequest(context.scope, signal, context.session.accessVersion),
  );
  return parseTask(value);
}

export function taskStorageKey(context: ConsoleContext): string {
  return `console:order-exports:${context.scope.kind}:${context.scope.id}`;
}

function parseTask(value: unknown): OrderExportTask {
  const row = record(value, '导出任务响应无效');
  const state = string(row.state, '导出任务状态缺失');
  if (!['queued', 'running', 'completed', 'failed', 'expired'].includes(state)) throw new Error('导出任务状态无效');
  const filter = record(row.filter ?? {}, '导出任务筛选快照无效');
  const download = row.download === undefined ? undefined : record(row.download, '下载地址无效');
  return Object.freeze({
    id: string(row.id, '导出任务编号缺失'),
    state: state as OrderExportState,
    recordCount: number(row.recordCount),
    createdAt: string(row.createdAt, '导出创建时间缺失'),
    generatedAt: nullableString(row.generatedAt),
    errorCode: nullableString(row.errorCode),
    filter,
    ...(download === undefined ? {} : { download: Object.freeze({ url: string(download.url, '下载地址缺失'), ...(typeof download.expiresAt === 'string' ? { expiresAt: download.expiresAt } : {}) }) }),
  });
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
function string(value: unknown, message: string): string { if (typeof value !== 'string' || value === '') throw new Error(message); return value; }
function nullableString(value: unknown): string | null { return typeof value === 'string' && value !== '' ? value : null; }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
