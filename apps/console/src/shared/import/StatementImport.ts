import { PROVIDER_UI_CATALOGS, type OperationOutputFor } from '@shop/contract';
import type { ContractJsonValue } from '@shop/contract/schema';
import type { UploadedImport } from './ImportUploadGateway';

type ConnectionPage = OperationOutputFor<'channel.connections.read'>;
type ImportCreated = OperationOutputFor<'finance.statementimports.create'>;
type ImportRead = OperationOutputFor<'finance.statementimports.read'>;

export const STATEMENT_IMPORT_TEMPLATE = Object.freeze({
  title: '渠道账单标准模板',
  description: 'Provider 适配器把渠道原始字段映射为统一账单行；文件只能创建 Statement 并触发对账，不能写分录或直接修改余额。',
  columns: Object.freeze(['reference', 'type', 'amountMinor', 'taxMinor', 'occurredAt']),
  mapping: Object.freeze([
    Object.freeze({ key: 'reference', label: '渠道业务凭证', description: 'Provider 内唯一的订单、支付或退款凭证。' }),
    Object.freeze({ key: 'type', label: '资金类型', description: '仅允许 payment 或 refund。' }),
    Object.freeze({ key: 'amountMinor', label: '金额（分）', description: '带符号规则由服务端 Provider 映射统一校验。' }),
    Object.freeze({ key: 'taxMinor', label: '税额（分）', description: '没有税额时填 0。' }),
    Object.freeze({ key: 'occurredAt', label: '业务发生时间', description: '使用带时区的标准时间。' }),
  ]),
});

export interface StatementProvider {
  readonly value: string;
  readonly label: string;
  readonly business: string;
  readonly help: string;
  readonly connection: string;
  readonly contractVersion: string;
  readonly region: string;
}

export interface StatementProviderOptions {
  readonly items: readonly StatementProvider[];
  readonly reason: string | null;
}

export interface StatementImportMetadata {
  readonly provider: string;
  readonly partnerId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly openingMinor: string;
  readonly closingMinor: string;
}

export interface StatementImportDraft extends StatementImportMetadata {
  readonly file: File | null;
  readonly confirmed: boolean;
}

export interface StatementImportError {
  readonly row: number;
  readonly reason: string;
  readonly field: string | null;
  readonly detail: ContractJsonValue;
}

export interface StatementImportTask {
  readonly id: string;
  readonly state: string;
  readonly total: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly validation: ContractJsonValue;
  readonly lastError: string | null;
  readonly errors: readonly StatementImportError[];
  readonly report?: Readonly<{ sha256: string; size: number; download: string }>;
}

export function statementProviderOptions(page: ConnectionPage): StatementProviderOptions {
  const statementConnections = page.items.filter((item) => item.capabilities?.includes('Statement'));
  const available = statementConnections.filter((item) => item.status === 'enabled' && item.health_state === 'healthy');
  const seen = new Set<string>();
  const items = available.flatMap((connection) => {
    if (seen.has(connection.provider)) return [];
    const catalog = PROVIDER_UI_CATALOGS.find((entry) => entry.id === connection.provider && entry.capabilities.includes('Statement'));
    if (!catalog) return [];
    seen.add(connection.provider);
    return [Object.freeze({ value: catalog.id, label: catalog.name, business: catalog.business, help: catalog.help, connection: connection.id, contractVersion: connection.contract_version, region: connection.region })];
  });
  const reason = items.length > 0
    ? null
    : statementConnections.length > 0
      ? '当前范围的账单渠道尚未启用，或最近一次健康检查未通过。'
      : '当前范围没有声明 Statement 能力的 Provider 连接。';
  return Object.freeze({ items: Object.freeze(items), reason });
}

export function mapStatementImportCreated(value: ImportCreated): StatementImportTask {
  return Object.freeze({ id: value.id, state: value.state, total: value.total_count, processed: value.cursor_value, succeeded: value.success_count, failed: value.failure_count, createdAt: value.created_at, updatedAt: value.updated_at, validation: Object.freeze({}), lastError: null, errors: Object.freeze([]) });
}

export function mapStatementImportRead(value: ImportRead): StatementImportTask {
  return Object.freeze({
    id: value.id,
    state: value.state,
    total: value.total_count,
    processed: value.cursor_value,
    succeeded: value.success_count,
    failed: value.failure_count,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    validation: value.validation_summary,
    lastError: value.last_error,
    errors: Object.freeze(value.errors.map((error) => Object.freeze({ row: error.row_number, reason: error.reason_code, field: error.field, detail: error.detail }))),
    ...(value.report === undefined ? {} : { report: Object.freeze(value.report) }),
  });
}

export function statementImportBody(upload: UploadedImport, metadata: StatementImportMetadata) {
  return Object.freeze({
    objectRef: upload.objectRef,
    sha256: upload.sha256,
    fileName: upload.fileName,
    provider: metadata.provider.trim(),
    partnerId: metadata.partnerId.trim(),
    periodStart: metadata.periodStart,
    periodEnd: metadata.periodEnd,
    currency: 'CNY' as const,
    openingMinor: Number(metadata.openingMinor),
    closingMinor: Number(metadata.closingMinor),
  });
}
