import {
  createFetchVoucherBatchesRead,
  createFetchVoucherCardlibrariesRead,
  createFetchVoucherProgramsRead,
  createFetchVoucherReservesRead,
} from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { CardLibraryPageSchema, IssueBatchPageSchema, ReservePageSchema, VoucherProgramPageSchema,
  type VoucherRecord, type VoucherRecordPage, type VoucherView } from './VoucherSchema';

const cardlibrariesRead = createFetchVoucherCardlibrariesRead(appConfig.apiBaseUrl);
const programsRead = createFetchVoucherProgramsRead(appConfig.apiBaseUrl);
const reservesRead = createFetchVoucherReservesRead(appConfig.apiBaseUrl);
const batchesRead = createFetchVoucherBatchesRead(appConfig.apiBaseUrl);

export const voucherViews = ['programs', 'libraries', 'reserves', 'batches'] as const;
export const voucherKey = (context: ConsoleContext, view: VoucherView, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, operation(view), cursor ?? null, 50,
] as const);

export async function readVouchers(context: ConsoleContext, view: VoucherView, cursor: string | undefined, signal: AbortSignal): Promise<VoucherRecordPage> {
  const prefetched = await takeDocumentVoucherPrefetch(context, view, cursor, signal);
  if (prefetched !== undefined) return prefetched;
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  if (view === 'libraries') {
    return parseVoucherPage(view, await cardlibrariesRead(input, request));
  }
  if (view === 'programs') {
    return parseVoucherPage(view, await programsRead(input, request));
  }
  if (view === 'reserves') {
    return parseVoucherPage(view, await reservesRead(input, request));
  }
  return parseVoucherPage(view, await batchesRead(input, request));
}

function parseVoucherPage(view: VoucherView, value: unknown): VoucherRecordPage {
  if (view === 'libraries') {
    const page = CardLibraryPageSchema.parse(value);
    return mapPage(page, (row) => ({ id: row.id, name: row.code_prefix, state: row.status,
      detail: `${row.mode}${row.import_state === undefined || row.import_state === null ? '' : ` · ${row.import_state}`}`,
      quantity: row.success_count ?? row.total_count ?? null, amountMinor: null, currency: null, occurredAt: null, version: row.version }));
  }
  if (view === 'programs') {
    const page = VoucherProgramPageSchema.parse(value);
    return mapPage(page, (row) => ({ id: row.id, name: row.name, state: row.status,
      detail: row.approval_required ? '需要审批' : '无需审批', quantity: null, amountMinor: row.value_minor,
      currency: row.currency, occurredAt: null, version: row.version }));
  }
  if (view === 'reserves') {
    const page = ReservePageSchema.parse(value);
    return mapPage(page, (row) => ({ id: row.id, name: row.name, state: row.state, detail: row.request_number,
      quantity: row.requested_count, amountMinor: row.requested_minor, currency: null, occurredAt: row.created_at, version: null }));
  }
  const page = IssueBatchPageSchema.parse(value);
  return mapPage(page, (row) => ({ id: row.id, name: row.name, state: row.state,
    detail: `已发行 ${row.issued_count} / ${row.requested_count}`, quantity: row.issued_count,
    amountMinor: null, currency: null, occurredAt: row.created_at, version: null }));
}

async function takeDocumentVoucherPrefetch(
  context: ConsoleContext,
  view: VoucherView,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleVoucherPrefetch;
  delete window.__consoleVoucherPrefetch;
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
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion
      && value.view === view
      && value.cursor === cursor;
    if (!matches) return undefined;
    try { return parseVoucherPage(view, value.value); } catch { return undefined; }
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

function operation(view: VoucherView): string {
  return view === 'libraries' ? 'voucher.cardlibraries.read' : view === 'programs' ? 'voucher.programs.read'
    : view === 'reserves' ? 'voucher.reserves.read' : 'voucher.batches.read';
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (value: T) => VoucherRecord): VoucherRecordPage {
  return Object.freeze({ items: Object.freeze(page.items.map(map)), count: page.count,
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
