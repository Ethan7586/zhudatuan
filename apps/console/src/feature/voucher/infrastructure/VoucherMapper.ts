import type { VoucherRecord, VoucherRecordPage, VoucherView } from '../model/Voucher';
import { BindingPageSchema, CardLibraryPageSchema, HistoryPageSchema, IssueBatchPageSchema, RedemptionPageSchema, ReservePageSchema, StatusBatchPageSchema, VoucherProgramPageSchema } from './VoucherSchema';

export class VoucherMapper {
  page(view: VoucherView, value: unknown): VoucherRecordPage {
    if (view === 'libraries')
      return mapPage(CardLibraryPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: row.code_prefix,
        state: row.status,
        detail: `${row.mode}${row.import_state ? ` · ${row.import_state}` : ''}`,
        quantity: row.success_count ?? row.total_count ?? null,
        amountMinor: null,
        currency: null,
        occurredAt: null,
        version: row.version,
      }));
    if (view === 'programs')
      return mapPage(VoucherProgramPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: row.name,
        state: row.status,
        detail: row.approval_required ? '需要审批' : '无需审批',
        quantity: null,
        amountMinor: row.value_minor,
        currency: row.currency,
        occurredAt: null,
        version: row.version,
        programId: row.id,
        approvalRequired: row.approval_required,
        validityDays: row.default_valid_days,
      }));
    if (view === 'reserves')
      return mapPage(ReservePageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: row.name,
        state: row.state,
        detail: row.request_number,
        quantity: row.requested_count,
        amountMinor: row.requested_minor,
        currency: null,
        occurredAt: row.created_at,
        version: row.program_version,
        programId: row.program_id,
        requestedBy: row.requested_by,
      }));
    if (view === 'batches')
      return mapPage(IssueBatchPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: row.name,
        state: row.state,
        detail: `已发行 ${row.issued_count} / ${row.requested_count}`,
        quantity: row.issued_count,
        amountMinor: null,
        currency: null,
        occurredAt: row.created_at,
        version: row.program_version,
        programId: row.program_id,
        cardpoolId: row.cardpool_id,
        reserveId: row.reserve_request_id,
      }));
    if (view === 'statusbatches')
      return mapPage(StatusBatchPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: statusAction(row.action),
        state: row.state,
        detail: `成功 ${row.succeeded_count} · 失败 ${row.failed_count}`,
        quantity: row.requested_count,
        amountMinor: null,
        currency: null,
        occurredAt: row.created_at,
        version: null,
      }));
    if (view === 'bindings')
      return mapPage(BindingPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: row.name,
        state: row.state,
        detail: row.member_id ? `已绑定成员` : '待绑定',
        quantity: null,
        amountMinor: row.remaining_minor,
        currency: 'CNY',
        occurredAt: row.expires_at,
        version: row.version,
        programId: row.program_id,
        voucherId: row.id,
        memberId: row.member_id,
      }));
    if (view === 'redemptions')
      return mapPage(RedemptionPageSchema.parse(value), (row) => ({
        id: row.id,
        kind: view,
        name: `消费回执`,
        state: row.receipt_state,
        detail: row.order_id ? '关联订单消费' : '独立核销消费',
        quantity: null,
        amountMinor: row.amount_minor - row.reversed_minor,
        currency: 'CNY',
        occurredAt: row.redeemed_at,
        version: row.version,
        programId: row.program_id,
        voucherId: row.voucher_id,
      }));
    return mapPage(HistoryPageSchema.parse(value), (row) => ({
      id: row.cursor_id,
      kind: view,
      name: '状态记录',
      state: row.next_state,
      detail: row.reason,
      quantity: row.sequence,
      amountMinor: null,
      currency: null,
      occurredAt: row.occurred_at,
      version: row.sequence,
      voucherId: row.voucher_id,
    }));
  }
}

function mapPage<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (value: T) => VoucherRecord): VoucherRecordPage {
  return Object.freeze({ items: Object.freeze(page.items.map((item) => Object.freeze(map(item)))), count: page.count, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
}

function statusAction(value: string): string {
  return ({ activate: '批量激活', disable: '批量禁用', extend: '批量延期', void: '批量作废' } as const)[value as 'activate'] ?? '批量状态操作';
}
