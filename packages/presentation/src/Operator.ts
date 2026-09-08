import type { ActionInput, OperatorAction } from './Action';
import { chineseDomainLabel } from './ChineseDomain';
import type { DisplayCollection, DisplayRow } from './RecordProjection';

export type OperatorRecord = Readonly<Record<string, unknown>>;

export interface OperatorCommandResult {
  readonly message: string;
  readonly destination?: string;
  readonly data?: unknown;
  readonly sessionEnded?: boolean;
  readonly refresh?: boolean;
}

export interface OperatorFeature<Client, Context, Route> {
  readonly routes: readonly string[];
  readonly title: string;
  readonly description: string;
  readonly read: (client: Client, context: Context, route: Route) => Promise<unknown>;
  readonly project?: (value: unknown, route: Route) => DisplayCollection;
  readonly actions?: (value: unknown, route: Route, selectedKey?: string) => readonly OperatorAction[];
  readonly execute?: (
    client: Client,
    context: Context,
    route: Route,
    value: unknown,
    selectedKey: string | undefined,
    action: OperatorAction,
    input: ActionInput
  ) => Promise<OperatorCommandResult>;
}

export function defineOperatorFeature<Client, Context, Route>(definition: OperatorFeature<Client, Context, Route>, missingCode: string): OperatorFeature<Client, Context, Route> {
  if (definition.routes.length === 0) throw new Error(missingCode);
  return Object.freeze({ ...definition, routes: Object.freeze([...definition.routes]) });
}

export function operatorRecord(value: unknown): OperatorRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as OperatorRecord) : undefined;
}

export function operatorItems(value: unknown): readonly OperatorRecord[] {
  const source = operatorRecord(value)?.items;
  return Array.isArray(source) ? Object.freeze(source.map(operatorRecord).filter((item): item is OperatorRecord => item !== undefined)) : Object.freeze([]);
}

export function selectedOperatorRecord(value: unknown, key: string | undefined): OperatorRecord | undefined {
  return key === undefined ? undefined : operatorItems(value).find((item) => operatorText(item, 'id') === key);
}

export function operatorText(value: OperatorRecord, key: string): string {
  const field = value[key];
  return typeof field === 'string' ? field : typeof field === 'number' && Number.isFinite(field) ? String(field) : '';
}

export function operatorNumber(value: OperatorRecord, key: string): number | undefined {
  const field = value[key];
  return typeof field === 'number' && Number.isSafeInteger(field) ? field : undefined;
}

export function operatorCollection(value: unknown, rows: readonly DisplayRow[]): DisplayCollection {
  const page = operatorRecord(value);
  const count = typeof page?.count === 'number' && Number.isSafeInteger(page.count) && page.count >= rows.length ? page.count : rows.length;
  const nextCursor = typeof page?.nextCursor === 'string' ? page.nextCursor : null;
  return Object.freeze({ rows: Object.freeze([...rows]), count, nextCursor });
}

export function operatorRow(value: Readonly<{ key: string; title: string; detail: string; status?: string; statusLabel?: string; timestamp?: string }>): DisplayRow {
  return Object.freeze({ key: value.key, title: value.title, detail: value.detail, status: value.statusLabel ?? chineseDomainLabel(value.status ?? '', '已同步'), timestamp: value.timestamp ?? '' });
}

export function shortOperatorId(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function fulfillmentWorkStatus(state: string, priority: string, context: 'order' | 'fulfillment'): string {
  if (priority === 'overdue') return '已逾期';
  if (priority === 'risk') return '需优先处理';
  if (state === 'submitted') return context === 'order' ? '待接单' : '待备货';
  if (state === 'accepted') return '已接单';
  if (state === 'processing') return context === 'order' ? '备货中' : '备货或发货中';
  return state === 'ready' ? (context === 'order' ? '待交付' : '待发货') : chineseDomainLabel(state, '状态待确认');
}

export function supportCaseStatus(state: string, risk: string): string {
  if (risk === 'overdue') return '服务已逾期';
  if (risk === 'risk') return '临近服务时限';
  if (state === 'waiting') return '等待顾客';
  if (state === 'assigned') return '处理中';
  return state === 'open' ? '待处理' : '已完成';
}
