export type VoucherPreviewView = 'cardlibraries' | 'programs' | 'reserves' | 'batches';

export interface VoucherPreviewPage {
  readonly items: readonly Readonly<Record<string, unknown>>[];
  readonly count: number;
}

const pages: Readonly<Record<VoucherPreviewView, VoucherPreviewPage>> = Object.freeze({
  programs: page([
    { id: 'voucher-program:new-employee', name: '新员工入职礼包', value_minor: 3_000, currency: 'CNY', status: 'active', approval_required: true, version: 12 },
    { id: 'voucher-program:summer-care', name: '夏季高温关怀券', value_minor: 4_000, currency: 'CNY', status: 'active', approval_required: true, version: 7 },
    { id: 'voucher-program:mid-autumn', name: '中秋礼盒兑换券', value_minor: 19_900, currency: 'CNY', status: 'draft', approval_required: true, version: 3 },
    { id: 'voucher-program:employee-discount', name: '核心企业员工专享折扣', value_minor: 8_000, currency: 'CNY', status: 'draft', approval_required: true, version: 2 },
    { id: 'voucher-program:commute', name: '员工通勤补贴券', value_minor: 1_500, currency: 'CNY', status: 'paused', approval_required: true, version: 18 },
    { id: 'voucher-program:qixi', name: '七夕员工关怀礼遇', value_minor: 5_200, currency: 'CNY', status: 'retired', approval_required: true, version: 9 },
  ]),
  cardlibraries: page([
    { id: 'cardlibrary:employee-202608', code_prefix: 'SW-EMP-2608', mode: 'generated', status: 'ready', version: 5, import_state: null, total_count: 5_000, success_count: 5_000, failure_count: 0 },
    { id: 'cardlibrary:mid-autumn-202609', code_prefix: 'SW-MAF-2609', mode: 'imported', status: 'ready', version: 3, import_state: 'completed', total_count: 300, success_count: 298, failure_count: 2 },
    { id: 'cardlibrary:commute-202607', code_prefix: 'SW-COM-2607', mode: 'generated', status: 'depleted', version: 8, import_state: null, total_count: 10_000, success_count: 10_000, failure_count: 0 },
  ]),
  reserves: page([
    { id: 'reserve:260827-001', request_number: 'RSV-20260827-001', name: '九月新员工福利备券', requested_count: 5_000, requested_minor: 15_000_000, state: 'submitted', created_at: '2026-08-27T02:18:00.000Z' },
    { id: 'reserve:260825-003', request_number: 'RSV-20260825-003', name: '中秋礼盒专项备券', requested_count: 300, requested_minor: 5_970_000, state: 'approved', created_at: '2026-08-25T06:40:00.000Z' },
    { id: 'reserve:260820-002', request_number: 'RSV-20260820-002', name: '通勤补贴追加额度', requested_count: 2_000, requested_minor: 3_000_000, state: 'rejected', created_at: '2026-08-20T08:12:00.000Z' },
    { id: 'reserve:260815-001', request_number: 'RSV-20260815-001', name: '七夕员工关怀额度', requested_count: 2_000, requested_minor: 10_400_000, state: 'fulfilled', created_at: '2026-08-15T01:35:00.000Z' },
  ]),
  batches: page([
    { id: 'issuebatch:260827-004', name: '线下快闪店扫码礼', state: 'approval', requested_count: 800, issued_count: 0, created_at: '2026-08-27T05:40:00.000Z' },
    { id: 'issuebatch:260825-003', name: '企微社群秋日福利', state: 'issuing', requested_count: 500, issued_count: 384, created_at: '2026-08-25T03:18:00.000Z' },
    { id: 'issuebatch:260820-002', name: '小红书达人合作', state: 'completed', requested_count: 300, issued_count: 300, created_at: '2026-08-20T07:25:00.000Z' },
    { id: 'issuebatch:260815-001', name: '七夕会员短信', state: 'failed', requested_count: 1_000, issued_count: 932, created_at: '2026-08-15T01:12:00.000Z' },
  ]),
});

export function voucherPreviewPage(view: VoucherPreviewView): VoucherPreviewPage {
  return pages[view];
}

function page(items: readonly Readonly<Record<string, unknown>>[]): VoucherPreviewPage {
  return Object.freeze({ items: Object.freeze(items.map((item) => Object.freeze({ ...item }))), count: items.length });
}
