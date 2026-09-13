import { createFetchOrderOrdersRead } from '@shop/sdk/order';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { OrderPageSchema, type OrderFilter, type OrderListFilter, type OrderView } from './OrderSchema';
import { parseOrderExportTask } from './OrderExportQuery';

const ordersRead = createFetchOrderOrdersRead(appConfig.apiBaseUrl);
export const ORDER_PAGE_LIMIT = 50;

export interface OrderQuery extends OrderFilter, Partial<Omit<OrderListFilter, 'order'>> {
  readonly cursor?: string;
  readonly view?: OrderView;
}

export const isOrderPreviewContext = (context: ConsoleContext): boolean => context.scope.kind === 'platform' && context.scope.id === 'platform:preview';

export const orderKey = (context: ConsoleContext, filter: OrderQuery) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    'order.orders.read',
    filter.order,
    filter.placed ?? '',
    filter.lifecycle ?? '',
    filter.payment ?? '',
    filter.fulfillment ?? '',
    filter.mall ?? '',
    filter.view ?? 'all',
    filter.cursor ?? null,
    ORDER_PAGE_LIMIT,
  ] as const);

export async function readOrders(context: ConsoleContext, filter: OrderQuery, signal: AbortSignal) {
  const prefetched = await takeDocumentOrderPrefetch(context, filter, signal);
  if (prefetched !== undefined) return prefetched;
  const value = await ordersRead(
    {
      query: {
        limit: ORDER_PAGE_LIMIT,
        ...(filter.order === '' ? {} : { order: filter.order }),
        ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
        ...(filter.placed ? { placed: filter.placed } : {}),
        ...(filter.lifecycle ? { lifecycle: filter.lifecycle } : {}),
        ...(filter.payment ? { payment: filter.payment } : {}),
        ...(filter.fulfillment ? { fulfillment: filter.fulfillment } : {}),
        ...(filter.mall ? { mall: filter.mall } : {}),
        ...(filter.view !== undefined && filter.view !== 'all' ? { view: filter.view } : {}),
        exports: 'true',
      },
    },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  const page = OrderPageSchema.parse(value);
  const exports = value !== null && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as Record<string, unknown>).exports)
    ? (value as Record<string, unknown>).exports as unknown[]
    : [];
  return Object.freeze({ ...page, exports: Object.freeze(exports.map(parseOrderExportTask)) });
}

async function takeDocumentOrderPrefetch(context: ConsoleContext, filter: OrderQuery, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleOrderPrefetch;
  delete window.__consoleOrderPrefetch;
  if (slot === undefined) return undefined;
  if (signal.aborted) {
    window.__consoleAbortDocumentPrefetch?.();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  let rejectAbort: (cause: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const abort = () => {
    window.__consoleAbortDocumentPrefetch?.();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = await Promise.race([slot.promise, aborted]);
    const query = value?.query;
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion
      && query?.order === filter.order
      && query.placed === (filter.placed ?? '')
      && query.lifecycle === (filter.lifecycle ?? '')
      && query.payment === (filter.payment ?? '')
      && query.fulfillment === (filter.fulfillment ?? '')
      && query.mall === (filter.mall ?? '')
      && query.view === (filter.view ?? 'all')
      && query.cursor === filter.cursor;
    if (!matches) return undefined;
    const parsed = OrderPageSchema.safeParse(value.value);
    if (!parsed.success) return undefined;
    const raw = value.value as Record<string, unknown>;
    const exports = Array.isArray(raw.exports) ? raw.exports : [];
    return Object.freeze({ ...parsed.data, exports: Object.freeze(exports.map(parseOrderExportTask)) });
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
