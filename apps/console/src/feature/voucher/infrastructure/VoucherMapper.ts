import * as Operation from '@shop/contract/ids';
import type { VoucherChoiceKind, VoucherChoicePage, VoucherFacets, VoucherOperation, VoucherProgress, VoucherProgressKind, VoucherReceipt, VoucherRecord, VoucherRecordPage, VoucherTimeline, VoucherTimelineEntry, VoucherView } from '../model/Voucher';

const jobOperations = new Set<VoucherOperation>([Operation.OP_VOUCHER_CREDENTIALS_GENERATE, Operation.OP_VOUCHER_CREDENTIALS_IMPORT]);
const exportOperations = new Set<VoucherOperation>([Operation.OP_VOUCHER_CREDENTIALEXPORTS_CREATE, Operation.OP_VOUCHER_ISSUEORDEREXPORTS_CREATE, Operation.OP_VOUCHER_ACTIONEXPORTS_CREATE, Operation.OP_VOUCHER_SEARCHEXPORTS_CREATE]);
const actionOperations = new Set<VoucherOperation>([Operation.OP_VOUCHER_ACTIONBATCHES_CREATE, Operation.OP_VOUCHER_ACTIONBATCHES_RETRY]);

export class VoucherMapper {
  page(view: VoucherView, value: unknown): VoucherRecordPage {
    const source = record(value);
    const items = Array.isArray(source.items) ? source.items.map((item) => this.item(view, item)) : [];
    const nextCursor = text(source.nextCursor);
    return Object.freeze({ items: Object.freeze(items), count: count(source.count) ?? items.length, ...(nextCursor ? { nextCursor } : {}) });
  }

  single(view: VoucherView, value: unknown): VoucherRecord {
    return this.item(view, value);
  }

  choices(kind: VoucherChoiceKind, value: unknown): VoucherChoicePage {
    const source = record(value);
    const items = Array.isArray(source.items) ? source.items.map((item) => choice(kind, record(item))) : [];
    const nextCursor = text(source.nextCursor);
    return Object.freeze({ items: Object.freeze(items), ...(nextCursor ? { nextCursor } : {}) });
  }

  facets(value: unknown): VoucherFacets {
    const source = record(value);
    return Object.freeze({
      states: facetList(source.states),
      products: facetList(source.products),
      pools: facetList(source.pools),
      watermark: requiredText(source.watermark, 'VOUCHER_FACET_WATERMARK_MISSING'),
    });
  }

  timeline(value: unknown): VoucherTimeline {
    const source = record(value);
    const items: VoucherTimelineEntry[] = Array.isArray(source.items) ? source.items.map((item) => timelineEntry(record(item))) : [];
    const nextCursor = text(source.nextCursor);
    return Object.freeze({ items: Object.freeze(items), ...(nextCursor ? { nextCursor } : {}) });
  }

  progress(kind: VoucherProgressKind, value: unknown): VoucherProgress {
    const source = record(value);
    const processed = count(source.processed) ?? 0;
    const total = count(source.total) ?? count(source.requested) ?? processed;
    return Object.freeze({
      id: requiredText(source.id, 'VOUCHER_PROGRESS_ID_MISSING'), kind,
      state: requiredText(source.state, 'VOUCHER_PROGRESS_STATE_MISSING'), processed, total,
      succeeded: count(source.succeeded) ?? 0, failed: count(source.failed) ?? 0, retryable: count(source.retryable) ?? 0,
      fileName: text(source.fileName) ?? null, downloadToken: text(source.downloadToken) ?? null,
      expiresAt: text(source.expiresAt) ?? null,
      updatedAt: requiredText(source.updatedAt, 'VOUCHER_PROGRESS_TIME_MISSING'),
    });
  }

  receipt(operation: VoucherOperation, value: unknown): VoucherReceipt {
    const source: Readonly<Record<string, unknown>> = value && typeof value === 'object' && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : Object.freeze({});
    const kind = jobOperations.has(operation) ? 'job' : exportOperations.has(operation) ? 'export' : actionOperations.has(operation) ? 'action' : operation === Operation.OP_VOUCHER_ISSUEBATCHES_RETRY || text(source.issueBatch) ? 'issue' : 'record';
    const reference = kind === 'issue' ? text(source.issueBatch) ?? text(source.id) ?? null : text(source.id) ?? text(source.job) ?? text(source.export) ?? text(source.approval) ?? null;
    const state = text(source.state) ?? null;
    const message = `${reference ? `业务编号 ${reference}` : '服务端已确认受理'}${state ? `，当前状态 ${state}` : ''}`;
    return Object.freeze({ operation, reference, state, kind, message });
  }

  private item(view: VoucherView, value: unknown): VoucherRecord {
    const row = Object.freeze({ ...record(value) });
    const id = requiredText(row.id, 'VOUCHER_RESULT_ID_MISSING');
    return Object.freeze({
      id,
      kind: view,
      name: title(view, row, id),
      state: text(row.state) ?? 'unknown',
      detail: description(view, row),
      quantity: quantity(view, row),
      amountMinor: integer(row.faceMinor) ?? integer(row.remainingMinor) ?? integer(row.amountMinor),
      currency: text(row.currency) ?? null,
      occurredAt: text(row.updatedAt) ?? text(row.createdAt) ?? text(row.redeemedAt) ?? null,
      version: integer(row.version),
      raw: row,
    });
  }
}

function choice(kind: VoucherChoiceKind, row: Readonly<Record<string, unknown>>) {
  const id = requiredText(kind === 'stock' ? row.request : row.id, 'VOUCHER_OPTION_ID_MISSING');
  if (kind === 'product') {
    const name = requiredText(row.name, 'VOUCHER_OPTION_NAME_MISSING');
    const number = requiredText(row.number, 'VOUCHER_OPTION_NUMBER_MISSING');
    const available = count(row.available) ?? 0;
    return Object.freeze({ id, label: `${name} · ${number}`, detail: `${money(count(row.faceMinor) ?? 0, text(row.currency) ?? 'CNY')} · 可用 ${available}`, fill: Object.freeze({ product: id }) });
  }
  const number = requiredText(row.number, 'VOUCHER_OPTION_NUMBER_MISSING');
  const available = count(row.available) ?? 0;
  return Object.freeze({ id, label: `${number} · 可发 ${available}`, detail: `客户 ${text(row.customer) ?? '—'} · 已审批 ${count(row.approved) ?? 0}`, fill: Object.freeze({ stockRequest: id, product: text(row.product) ?? '', pool: text(row.pool) ?? '', customer: text(row.customer) ?? '' }) });
}

function facetList(value: unknown) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map((item) => { const source = record(item); return Object.freeze({ value: requiredText(source.value, 'VOUCHER_FACET_VALUE_MISSING'), count: count(source.count) ?? 0 }); }));
}

function timelineEntry(row: Readonly<Record<string, unknown>>): VoucherTimelineEntry {
  const redemption = row.redemption === null ? null : record(row.redemption);
  return Object.freeze({
    sequence: count(row.sequence) ?? 0,
    previous: text(row.previous) ?? null,
    next: requiredText(row.next, 'VOUCHER_TIMELINE_STATE_MISSING'),
    reason: text(row.reason) ?? '系统状态变化', actor: requiredText(row.actor, 'VOUCHER_TIMELINE_ACTOR_MISSING'),
    occurredAt: requiredText(row.occurredAt, 'VOUCHER_TIMELINE_TIME_MISSING'), redemption,
  });
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value / 100);
}

function title(view: VoucherView, row: Readonly<Record<string, unknown>>, id: string): string {
  if (view === 'products' || view === 'pools') return text(row.name) ?? text(row.number) ?? id;
  if (view === 'credentials' || view === 'vouchers' || view === 'search') return text(row.numberMasked) ?? id;
  if (view === 'stocks' || view === 'issues') return text(row.number) ?? id;
  if (view === 'actions') return actionLabel(text(row.action)) ?? id;
  return `核销回执 ${id.slice(-8)}`;
}

function description(view: VoucherView, row: Readonly<Record<string, unknown>>): string {
  if (view === 'products') return `${text(row.number) ?? '未编号'} · ${activationLabel(text(row.activation))}`;
  if (view === 'pools') return `${text(row.mode) === 'imported' ? '安全导入' : '系统生成'} · 前缀 ${text(row.prefix) ?? '—'}`;
  if (view === 'credentials') return `卡号库 ${text(row.pool) ?? '—'} · 密钥版本 ${text(row.keyVersion) ?? '—'}`;
  if (view === 'stocks') return `${text(row.reason) ?? '库存申请'} · 客户 ${text(row.customer) ?? '—'}`;
  if (view === 'issues') return `${purposeLabel(text(row.purpose))} · ${text(row.delivery) === 'account' ? '直接到账' : '领取码'}`;
  if (view === 'actions') return `${actionLabel(text(row.action)) ?? '批量操作'} · 成功 ${count(row.succeeded) ?? 0} / ${count(row.requested) ?? 0}`;
  if (view === 'redemptions') return `凭证 ${text(row.voucher) ?? '—'} · 已退款 ${count(row.refundedMinor) ?? 0} 分`;
  return `产品 ${text(row.product) ?? '—'} · 持有人 ${text(row.holder) ?? '未绑定'}`;
}

function quantity(view: VoucherView, row: Readonly<Record<string, unknown>>): number | null {
  if (view === 'pools') return count(row.available) ?? count(row.capacity) ?? null;
  if (view === 'stocks' || view === 'issues') return count(row.quantity) ?? null;
  if (view === 'actions') return count(row.requested) ?? null;
  return null;
}
function actionLabel(value: string | undefined): string | undefined { return value ? ({ activate: '批量激活', disable: '批量停用', enable: '批量恢复', void: '批量作废', extend: '批量延期' } as Readonly<Record<string, string>>)[value] : undefined; }
function activationLabel(value: string | undefined): string { return ({ automatic: '自动激活', secret: '密钥激活', numbersecret: '卡号和密钥激活' } as Readonly<Record<string, string>>)[value ?? ''] ?? '未配置激活方式'; }
function purposeLabel(value: string | undefined): string { return ({ benefit: '福利发放', order: '订单履约', campaign: '活动发放', manual: '人工发放' } as Readonly<Record<string, string>>)[value ?? ''] ?? '发放'; }
function record(value: unknown): Readonly<Record<string, unknown>> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('VOUCHER_RESULT_INVALID'); return value as Readonly<Record<string, unknown>>; }
function text(value: unknown): string | undefined { return typeof value === 'string' && value ? value : undefined; }
function requiredText(value: unknown, code: string): string { const result = text(value); if (!result) throw new Error(code); return result; }
function integer(value: unknown): number | null { return typeof value === 'number' && Number.isSafeInteger(value) ? value : null; }
function count(value: unknown): number | undefined { const result = integer(value); return result !== null && result >= 0 ? result : undefined; }
