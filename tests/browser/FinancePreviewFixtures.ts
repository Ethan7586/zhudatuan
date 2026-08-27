export const FINANCE_PREVIEW_SOURCE = 'local-preview' as const;
export const FINANCE_PREVIEW_AS_OF = '2026-08-24T13:31:00.000Z';
export const FINANCE_PREVIEW_ACCOUNTING_DATE = '2026-08-24';
export const FINANCE_PREVIEW_LAST_RECONCILED_AT = '2026-08-24T13:26:00.000Z';

type ReconciliationState = 'received' | 'matching' | 'balanced' | 'difference' | 'resolved' | 'approved';
type ReconciliationItemState = 'matched' | 'difference' | 'resolutionpending' | 'resolved';

export interface FinancePreviewFacetValue {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface FinancePreviewFacets {
  readonly periods: readonly FinancePreviewFacetValue[];
  readonly channels: readonly FinancePreviewFacetValue[];
  readonly malls: readonly FinancePreviewFacetValue[];
  readonly statuses: readonly FinancePreviewFacetValue[];
  readonly differenceTypes: readonly FinancePreviewFacetValue[];
}

export interface FinanceRepairPreview {
  readonly source: typeof FINANCE_PREVIEW_SOURCE;
  readonly status: 'service-preview' | 'pending-review';
  readonly expiresAt: string;
  readonly plan: {
    readonly title: string;
    readonly description: string;
    readonly operation: string;
    readonly relatedPayment: string;
    readonly accountingDate: string;
    readonly scope: string;
  };
  readonly entries: readonly {
    readonly side: 'debit' | 'credit';
    readonly account: string;
    readonly amountMinor: number;
    readonly currency: 'CNY';
  }[];
  readonly result: {
    readonly ledgerBeforeMinor: number;
    readonly ledgerAfterMinor: number;
    readonly differenceBeforeMinor: number;
    readonly differenceAfterMinor: number;
    readonly settlementImpact: string;
  };
  readonly checks: readonly {
    readonly label: string;
    readonly state: 'passed' | 'blocked';
    readonly detail: string;
  }[];
  readonly reason: string;
  readonly evidence: readonly { readonly label: string; readonly value: string }[];
  readonly previewHash: string;
  readonly idempotencyKey: string;
  readonly sourceHash: string;
  readonly itemVersion: number;
  readonly previewVersion: number;
}

export interface FinanceReconciliationItem {
  readonly id: string;
  readonly externalMinor: number;
  readonly internalMinor: number;
  readonly differenceMinor: number;
  readonly state: ReconciliationItemState;
  readonly reasonCode: string | null;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly resolution: Readonly<Record<string, unknown>> | null;
  readonly resolvedBy: string | null;
  readonly approvedBy: string | null;
  readonly preview?: FinanceRepairPreview;
}

export interface FinanceReconciliationPreviewRow {
  readonly source: typeof FINANCE_PREVIEW_SOURCE;
  readonly batchId: string;
  readonly accountingDate: string;
  readonly channelLabel: string;
  readonly dataSourceLabel: string;
  readonly scopeLabel: string;
  readonly expectedCount: number;
  readonly matchedCount: number;
  readonly differenceCount: number;
  readonly paymentChannel: string;
  readonly mall: string;
  readonly differenceType: string;
  readonly completedAt: string | null;
}

export interface FinanceReconciliationRecord {
  readonly id: string;
  readonly scope_id: string;
  readonly provider: string;
  readonly partner_id: string;
  readonly period: string;
  readonly statement_ref: string;
  readonly statement_hash: string;
  readonly state: ReconciliationState;
  readonly debit_minor: number;
  readonly credit_minor: number;
  readonly difference_minor: number;
  readonly created_by: string;
  readonly approved_by: string | null;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly updated_at: string;
  readonly version: number;
  readonly item_counts: Readonly<Record<string, number>>;
  readonly items: readonly FinanceReconciliationItem[];
  readonly preview: FinanceReconciliationPreviewRow;
}

export interface FinanceReconciliationPreviewPage {
  readonly items: readonly FinanceReconciliationRecord[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly preview: {
    readonly source: typeof FINANCE_PREVIEW_SOURCE;
    readonly total: number;
    readonly page: number;
    readonly previousCursor?: string;
    readonly asOf: string;
    readonly accountingDate: string;
    readonly lastReconciledAt: string;
    readonly pendingDifferenceCount: number;
    readonly pendingReviewCount: number;
    readonly facets: FinancePreviewFacets;
  };
}

export class FinancePreviewQueryError extends Error {
  readonly status = 400;
  readonly code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID';

  constructor(code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID') {
    super(code);
    this.name = 'FinancePreviewQueryError';
    this.code = code;
  }
}

const firstStatementHash = '57a6f9134ad574751d2ecf0f1488da84d6c85924d02fb10c97b930e4a91f6bd2';

const repairPreview = Object.freeze({
  source: FINANCE_PREVIEW_SOURCE,
  status: 'service-preview',
  expiresAt: '2026-08-24T13:46:00.000Z',
  plan: Object.freeze({
    title: '重放缺失记账事件',
    description: '只重放缺失的记账事件；不修改或删除原支付、渠道账单及历史账本。',
    operation: 'finance.reconciliation.replay-missing-event',
    relatedPayment: 'PAY-20260824-0119',
    accountingDate: FINANCE_PREVIEW_ACCOUNTING_DATE,
    scope: '鸿泰集团 / 鸿泰惠民通',
  }),
  entries: Object.freeze([
    Object.freeze({ side: 'debit', account: 'cash / 微信渠道资金', amountMinor: 11_900, currency: 'CNY' }),
    Object.freeze({ side: 'credit', account: 'commerce.clearing / 商城清算', amountMinor: 11_900, currency: 'CNY' }),
  ]),
  result: Object.freeze({
    ledgerBeforeMinor: 19_600,
    ledgerAfterMinor: 31_500,
    differenceBeforeMinor: 11_900,
    differenceAfterMinor: 0,
    settlementImpact: '重新计算当前结算基础',
  }),
  checks: Object.freeze([
    Object.freeze({ label: '财务处理权限与 Level 3 二次验证有效', state: 'passed', detail: '本地服务预览快照已验证' }),
    Object.freeze({ label: '未发现相同 reference / 幂等键的账本分录', state: 'passed', detail: '服务端快照内无重复结果' }),
    Object.freeze({ label: '账期开放，sourceHash 与当前证据一致', state: 'passed', detail: '账期 2026-08-24' }),
    Object.freeze({ label: 'itemVersion 与预览版本一致', state: 'passed', detail: 'v7 = v7' }),
  ]),
  reason: 'payment.succeeded 记账事件未消费',
  evidence: Object.freeze([Object.freeze({ label: '渠道账单', value: 'SHA-256 · 57a6…6bd2' }), Object.freeze({ label: '支付回执', value: 'PAY-20260824-0119' }), Object.freeze({ label: '订单状态', value: 'SW202608240119 · paid' })]),
  previewHash: '8f4abf80412e835ac88275c38c7124e96f1a49892d331ac421476682aa5e91c2',
  idempotencyKey: 'FIN-20260824-0001',
  sourceHash: firstStatementHash,
  itemVersion: 7,
  previewVersion: 7,
} satisfies FinanceRepairPreview);

export const financePreviewReconciliations: readonly FinanceReconciliationRecord[] = Object.freeze([
  reconciliation({
    serial: 'wechat',
    batchId: 'RCN-20260824-WECHAT-001',
    provider: 'wechat_pay',
    channelLabel: '微信支付',
    paymentChannel: 'wechat',
    expectedCount: 3,
    matchedCount: 2,
    differenceCount: 1,
    debitMinor: 31_500,
    creditMinor: 19_600,
    differenceMinor: 11_900,
    state: 'difference',
    completedAt: '2026-08-24T13:26:00.000Z',
    statementHash: firstStatementHash,
    itemMinors: [10_000, 9_600],
    differenceItem: Object.freeze({
      id: 'DIFF-20260824-0001',
      externalMinor: 11_900,
      internalMinor: 0,
      differenceMinor: 11_900,
      state: 'difference',
      reasonCode: 'INTERNAL_REFERENCE_MISSING',
      evidence: Object.freeze({
        externalReference: 'PAY-20260824-0119',
        orderNumber: 'SW202608240119',
        channelTransaction: 'WX202608242131000119',
        kind: 'payment',
        rawHash: '37d2fe7c725ba790dbf7d19bb22e67b22a86196285a83111c15a4f9acc0a0403',
      }),
      resolution: null,
      resolvedBy: null,
      approvedBy: null,
      preview: repairPreview,
    }),
  }),
  reconciliation({
    serial: 'alipay',
    batchId: 'RCN-20260824-ALIPAY-001',
    provider: 'alipay',
    channelLabel: '支付宝',
    paymentChannel: 'alipay',
    expectedCount: 5,
    matchedCount: 5,
    differenceCount: 0,
    debitMinor: 42_600,
    creditMinor: 42_600,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:24:00.000Z',
    statementHash: '9178e75da24ac5dbe875461b663fe6676124e8197da4be3919773b939814f4db',
    itemMinors: [9_800, 8_900, 7_900, 8_100, 7_900],
  }),
  reconciliation({
    serial: 'union',
    batchId: 'RCN-20260824-UNION-001',
    provider: 'union_pay',
    channelLabel: '银联云闪付',
    paymentChannel: 'unionpay',
    expectedCount: 4,
    matchedCount: 4,
    differenceCount: 0,
    debitMinor: 29_800,
    creditMinor: 29_800,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:22:00.000Z',
    statementHash: '32ec8cadc78e9fd7a147852e27cd4b1010c2fc6d4be0293870fae47d43f569ff',
    itemMinors: [9_800, 7_000, 6_500, 6_500],
  }),
  reconciliation({
    serial: 'jdpay',
    batchId: 'RCN-20260824-JDPAY-001',
    provider: 'jd_pay',
    channelLabel: '京东支付',
    paymentChannel: 'jdpay',
    expectedCount: 2,
    matchedCount: 2,
    differenceCount: 0,
    debitMinor: 18_000,
    creditMinor: 18_000,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:20:00.000Z',
    statementHash: '046e192c610706915db9a50d5ebd0d064cff026104b1d43365ce9c521f195e22',
    itemMinors: [9_800, 8_200],
  }),
  reconciliation({
    serial: 'qqpay',
    batchId: 'RCN-20260824-QQPAY-001',
    provider: 'qq_wallet',
    channelLabel: 'QQ钱包',
    paymentChannel: 'qqpay',
    expectedCount: 3,
    matchedCount: 3,
    differenceCount: 0,
    debitMinor: 10_000,
    creditMinor: 10_000,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:18:00.000Z',
    statementHash: '0892fecbbe7232b08c92fc8c456a412ced6cbba7b1c659a95f4ff5a203aa920f',
    itemMinors: [4_000, 3_500, 2_500],
  }),
  reconciliation({
    serial: 'baidu',
    batchId: 'RCN-20260824-BAIDU-001',
    provider: 'baidu_wallet',
    channelLabel: '百度钱包',
    paymentChannel: 'baidupay',
    expectedCount: 1,
    matchedCount: 1,
    differenceCount: 0,
    debitMinor: 2_800,
    creditMinor: 2_800,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:16:00.000Z',
    statementHash: 'fe72dd698db0fcc5a77ac7c8b818f40c19e14309d7fd7d3663c6bab564162a75',
    itemMinors: [2_800],
  }),
  reconciliation({
    serial: 'wxwap',
    batchId: 'RCN-20260824-WXWAP-001',
    provider: 'wechat_pay_h5',
    channelLabel: '微信H5',
    paymentChannel: 'wechat-h5',
    expectedCount: 6,
    matchedCount: 6,
    differenceCount: 0,
    debitMinor: 56_600,
    creditMinor: 56_600,
    differenceMinor: 0,
    state: 'balanced',
    completedAt: '2026-08-24T13:14:00.000Z',
    statementHash: 'c5e6dbb6c5a0bb4e9823feb9a31427fd82d18daf1b6e50c6dad7932b46697306',
    itemMinors: [9_800, 12_000, 8_800, 10_000, 8_000, 8_000],
  }),
]);

export const financePreviewOverview = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      currency: 'CNY',
      balance_minor: 78_599_300,
      liability_minor: 13_826_400,
      income_minor: 24_863_200,
      expense_minor: 6_961_696,
      cash_minor: 31_500,
      journal_count: 18_642,
      watermark: FINANCE_PREVIEW_LAST_RECONCILED_AT,
    }),
  ]),
  preview: Object.freeze({
    source: FINANCE_PREVIEW_SOURCE,
    asOf: FINANCE_PREVIEW_AS_OF,
    accountingDate: FINANCE_PREVIEW_ACCOUNTING_DATE,
    lastReconciledAt: FINANCE_PREVIEW_LAST_RECONCILED_AT,
    pendingDifferenceCount: 1,
    pendingReviewCount: 0,
  }),
});

const facets = Object.freeze({
  periods: Object.freeze([facetValue(FINANCE_PREVIEW_ACCOUNTING_DATE, FINANCE_PREVIEW_ACCOUNTING_DATE, 7)]),
  channels: Object.freeze([
    facetValue('wechat', '微信支付', 1),
    facetValue('alipay', '支付宝', 1),
    facetValue('unionpay', '银联云闪付', 1),
    facetValue('jdpay', '京东支付', 1),
    facetValue('qqpay', 'QQ钱包', 1),
    facetValue('baidupay', '百度钱包', 1),
    facetValue('wechat-h5', '微信H5', 1),
  ]),
  malls: Object.freeze([facetValue('mall:huimin', '鸿泰惠民通', 7)]),
  statuses: Object.freeze([facetValue('difference', '有差异', 1), facetValue('balanced', '已对平', 6)]),
  differenceTypes: Object.freeze([facetValue('missing_journal_event', '记账事件缺失', 1), facetValue('none', '无差异', 6)]),
} satisfies FinancePreviewFacets);

export function financeReconciliationPreviewPage(search: URLSearchParams): FinanceReconciliationPreviewPage {
  const query = Object.freeze({
    q: textQuery(search, 'q').toLowerCase(),
    period: textQuery(search, 'period'),
    channel: textQuery(search, 'channel'),
    mall: textQuery(search, 'mall'),
    status: textQuery(search, 'status'),
    difference: textQuery(search, 'difference'),
    limit: limitQuery(search),
  });
  const fingerprint = JSON.stringify(query);
  const offset = cursorOffset(search.get('cursor'), fingerprint);
  const filtered = financePreviewReconciliations.filter((row) => matches(row, query));
  const items = Object.freeze(filtered.slice(offset, offset + query.limit));
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < filtered.length ? encodeCursor(nextOffset, fingerprint) : undefined;
  const previousOffset = Math.max(0, offset - query.limit);
  const previousCursor = offset === 0 ? undefined : previousOffset === 0 ? 'start' : encodeCursor(previousOffset, fingerprint);
  return Object.freeze({
    items,
    count: items.length,
    ...(nextCursor === undefined ? {} : { nextCursor }),
    preview: Object.freeze({
      source: FINANCE_PREVIEW_SOURCE,
      total: filtered.length,
      page: Math.floor(offset / query.limit) + 1,
      ...(previousCursor === undefined ? {} : { previousCursor }),
      asOf: FINANCE_PREVIEW_AS_OF,
      accountingDate: FINANCE_PREVIEW_ACCOUNTING_DATE,
      lastReconciledAt: FINANCE_PREVIEW_LAST_RECONCILED_AT,
      pendingDifferenceCount: 1,
      pendingReviewCount: 0,
      facets,
    }),
  });
}

interface ReconciliationSeed {
  readonly serial: string;
  readonly batchId: string;
  readonly provider: string;
  readonly channelLabel: string;
  readonly paymentChannel: string;
  readonly expectedCount: number;
  readonly matchedCount: number;
  readonly differenceCount: number;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly differenceMinor: number;
  readonly state: ReconciliationState;
  readonly completedAt: string;
  readonly statementHash: string;
  readonly itemMinors: readonly number[];
  readonly differenceItem?: FinanceReconciliationItem;
}

function reconciliation(seed: ReconciliationSeed): FinanceReconciliationRecord {
  const matched = seed.itemMinors.map((amountMinor, index) => matchedItem(seed.serial, index + 1, amountMinor));
  const items = Object.freeze(seed.differenceItem === undefined ? matched : [seed.differenceItem, ...matched]);
  return Object.freeze({
    id: `reconciliation:preview:${seed.serial}:20260824:001`,
    scope_id: 'platform:preview',
    provider: seed.provider,
    partner_id: 'partner:mall:huimin',
    period: FINANCE_PREVIEW_ACCOUNTING_DATE,
    statement_ref: `statement:preview:${seed.serial}:20260824`,
    statement_hash: seed.statementHash,
    state: seed.state,
    debit_minor: seed.debitMinor,
    credit_minor: seed.creditMinor,
    difference_minor: seed.differenceMinor,
    created_by: 'actor:finance:preview:initiator',
    approved_by: null,
    evidence: Object.freeze({
      rowCount: seed.expectedCount,
      provider: Object.freeze({ paymentsMinor: seed.debitMinor, refundsMinor: 0 }),
      internalNet: seed.creditMinor,
      differences: seed.differenceCount,
      statementHash: seed.statementHash,
    }),
    updated_at: seed.completedAt,
    version: seed.state === 'difference' ? 7 : 3,
    item_counts: Object.freeze(seed.differenceCount === 0 ? { matched: seed.matchedCount } : { matched: seed.matchedCount, difference: seed.differenceCount }),
    items,
    preview: Object.freeze({
      source: FINANCE_PREVIEW_SOURCE,
      batchId: seed.batchId,
      accountingDate: FINANCE_PREVIEW_ACCOUNTING_DATE,
      channelLabel: seed.channelLabel,
      dataSourceLabel: '渠道账单',
      scopeLabel: '鸿泰集团 / 鸿泰惠民通',
      expectedCount: seed.expectedCount,
      matchedCount: seed.matchedCount,
      differenceCount: seed.differenceCount,
      paymentChannel: seed.paymentChannel,
      mall: 'mall:huimin',
      differenceType: seed.differenceCount === 0 ? 'none' : 'missing_journal_event',
      completedAt: seed.completedAt,
    }),
  });
}

function matchedItem(serial: string, index: number, amountMinor: number): FinanceReconciliationItem {
  const padded = String(index).padStart(4, '0');
  return Object.freeze({
    id: `reconciliationitem:preview:${serial}:${padded}`,
    externalMinor: amountMinor,
    internalMinor: amountMinor,
    differenceMinor: 0,
    state: 'matched',
    reasonCode: null,
    evidence: Object.freeze({
      externalReference: `PAY-${serial.toUpperCase()}-20260824-${padded}`,
      kind: 'payment',
      rawHash: `${serial.charCodeAt(0).toString(16).padStart(2, '0')}${String(index).padStart(2, '0')}`.repeat(16),
    }),
    resolution: null,
    resolvedBy: null,
    approvedBy: null,
  });
}

function matches(row: FinanceReconciliationRecord, query: Readonly<{ q: string; period: string; channel: string; mall: string; status: string; difference: string }>): boolean {
  const itemText = row.items
    .map((item) => {
      const reference = item.evidence.externalReference;
      const order = item.evidence.orderNumber;
      const channelTransaction = item.evidence.channelTransaction;
      return `${item.id}\n${typeof reference === 'string' ? reference : ''}\n${typeof order === 'string' ? order : ''}\n${typeof channelTransaction === 'string' ? channelTransaction : ''}`;
    })
    .join('\n');
  const searchable = `${row.id}\n${row.preview.batchId}\n${row.statement_ref}\n${row.provider}\n${row.partner_id}\n${row.preview.channelLabel}\n${itemText}`.toLowerCase();
  return (
    (query.q === '' || searchable.includes(query.q)) &&
    (query.period === '' || row.period === query.period) &&
    (query.channel === '' || row.preview.paymentChannel === query.channel) &&
    (query.mall === '' || row.preview.mall === query.mall) &&
    (query.status === '' || row.state === query.status) &&
    (query.difference === '' || row.preview.differenceType === query.difference)
  );
}

function facetValue(value: string, label: string, count: number): FinancePreviewFacetValue {
  return Object.freeze({ value, label, count });
}

function textQuery(search: URLSearchParams, key: string): string {
  return (search.get(key) ?? '').trim().slice(0, 255);
}

function limitQuery(search: URLSearchParams): number {
  const raw = search.get('limit');
  const value = raw === null ? 50 : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new FinancePreviewQueryError('PREVIEW_LIMIT_INVALID');
  return value;
}

function cursorOffset(cursor: string | null, fingerprint: string): number {
  if (cursor === null || cursor === 'start') return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!isCursor(parsed) || parsed.fingerprint !== fingerprint) throw new Error('CURSOR_MISMATCH');
    return parsed.offset;
  } catch {
    throw new FinancePreviewQueryError('PREVIEW_CURSOR_INVALID');
  }
}

function encodeCursor(offset: number, fingerprint: string): string {
  return Buffer.from(JSON.stringify({ version: 1, offset, fingerprint }), 'utf8').toString('base64url');
}

function isCursor(value: unknown): value is Readonly<{ version: 1; offset: number; fingerprint: string }> {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return candidate.version === 1 && Number.isSafeInteger(candidate.offset) && (candidate.offset as number) >= 0 && typeof candidate.fingerprint === 'string';
}
