import {
  createFetchVoucherBatchesRead,
  createFetchVoucherCardlibrariesCreate,
  createFetchVoucherCardlibrariesRead,
  createFetchVoucherProgramsManage,
  createFetchVoucherProgramsRead,
  createFetchVoucherReservesRead,
} from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { CardLibraryPageSchema, IssueBatchPageSchema, ReservePageSchema, VoucherProgramPageSchema, type VoucherRecord, type VoucherRecordPage, type VoucherView } from './VoucherSchema';

const cardlibrariesRead = createFetchVoucherCardlibrariesRead(appConfig.apiBaseUrl);
const cardlibrariesCreate = createFetchVoucherCardlibrariesCreate(appConfig.apiBaseUrl);
const programsRead = createFetchVoucherProgramsRead(appConfig.apiBaseUrl);
const programsManage = createFetchVoucherProgramsManage(appConfig.apiBaseUrl);
const reservesRead = createFetchVoucherReservesRead(appConfig.apiBaseUrl);
const batchesRead = createFetchVoucherBatchesRead(appConfig.apiBaseUrl);

export const voucherViews = ['programs', 'libraries', 'reserves', 'batches'] as const;
export const voucherKey = (context: ConsoleContext, view: VoucherView, cursor?: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, operation(view), cursor ?? null, 50] as const);

export async function readVouchers(context: ConsoleContext, view: VoucherView, cursor: string | undefined, signal: AbortSignal): Promise<VoucherRecordPage> {
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  if (view === 'libraries') {
    const page = CardLibraryPageSchema.parse(await cardlibrariesRead(input, request));
    return mapPage(page, (row) => ({
      id: row.id,
      name: row.code_prefix,
      state: row.status,
      detail: `${row.mode}${row.import_state === undefined || row.import_state === null ? '' : ` · ${row.import_state}`}`,
      quantity: row.success_count ?? row.total_count ?? null,
      amountMinor: null,
      currency: null,
      occurredAt: null,
      version: row.version,
    }));
  }
  if (view === 'programs') {
    const page = VoucherProgramPageSchema.parse(await programsRead(input, request));
    return mapPage(page, (row) => ({
      id: row.id,
      name: row.name,
      state: row.status,
      detail: row.approval_required ? '需要审批' : '无需审批',
      quantity: null,
      amountMinor: row.value_minor,
      currency: row.currency,
      occurredAt: null,
      version: row.version,
    }));
  }
  if (view === 'reserves') {
    const page = ReservePageSchema.parse(await reservesRead(input, request));
    return mapPage(page, (row) => ({ id: row.id, name: row.name, state: row.state, detail: row.request_number, quantity: row.requested_count, amountMinor: row.requested_minor, currency: null, occurredAt: row.created_at, version: null }));
  }
  const page = IssueBatchPageSchema.parse(await batchesRead(input, request));
  return mapPage(page, (row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    detail: `已发行 ${row.issued_count} / ${row.requested_count}`,
    quantity: row.issued_count,
    amountMinor: null,
    currency: null,
    occurredAt: row.created_at,
    version: null,
  }));
}

export async function createCardLibrary(context: ConsoleContext, prefix: string, signal?: AbortSignal) {
  return cardlibrariesCreate(
    { body: { mode: 'generated', prefix: prefix.trim(), provider: null } },
    consoleCommand(context.scope, { ...(signal === undefined ? {} : { signal }), accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }) })
  );
}

export async function createVoucherProgram(
  context: ConsoleContext,
  input: Readonly<{ name: string; valueMinor: number; validityDays: number; approvalRequired: boolean }>,
  signal?: AbortSignal
) {
  return programsManage(
    {
      path: { programid: `voucher-program:${crypto.randomUUID()}` },
      body: { ...input, status: 'draft' },
    },
    consoleCommand(context.scope, {
      ...(signal === undefined ? {} : { signal }),
      accessVersion: context.session.accessVersion,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    })
  );
}

function operation(view: VoucherView): string {
  return view === 'libraries' ? 'voucher.cardlibraries.read' : view === 'programs' ? 'voucher.programs.read' : view === 'reserves' ? 'voucher.reserves.read' : 'voucher.batches.read';
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (value: T) => VoucherRecord): VoucherRecordPage {
  return Object.freeze({ items: Object.freeze(page.items.map(map)), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
