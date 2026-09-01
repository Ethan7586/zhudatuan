export const ORDER_PREVIEW_SOURCE = 'local-preview' as const;
export const ORDER_PREVIEW_TOTAL = 5_000;
export const ORDER_PREVIEW_UPDATED_AT = '2026-08-24T13:18:00.000Z';

export type OrderPaymentState = 'unpaid' | 'authorizing' | 'paid' | 'partially_refunded' | 'refunded' | 'failed';
export type OrderFulfillmentState = 'unallocated' | 'allocated' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type OrderAftersaleState = 'none' | 'requested' | 'processing' | 'resolved' | 'rejected';
export type OrderLifecycleState = 'created' | 'active' | 'completed' | 'cancelled' | 'closed';
export type OrderMilestoneState = 'complete' | 'current' | 'pending' | 'warning';
export type OrderView = 'all' | 'unpaid' | 'unshipped' | 'active' | 'completed' | 'aftersale' | 'exception';

export interface OrderPreviewLine {
  readonly id: string;
  readonly sku: string;
  readonly listing: string;
  readonly title: string;
  readonly quantity: number;
  readonly unitMinor: number;
  readonly totalMinor: number;
  readonly discountMinor: number;
  readonly payableMinor: number;
  readonly provider: string | null;
  readonly partner: string | null;
}

export interface OrderPreviewMilestone {
  readonly key: 'placed' | 'paid' | 'reserved' | 'unshipped' | 'shipping' | 'completed';
  readonly label: string;
  readonly state: OrderMilestoneState;
  readonly at?: string;
}

export interface OrderPreviewOperation {
  readonly id: string;
  readonly label: string;
  readonly status: 'succeeded' | 'pending' | 'failed';
  readonly at: string;
}

export interface OrderPreviewMetadata {
  readonly source: typeof ORDER_PREVIEW_SOURCE;
  readonly memberName: string;
  readonly enterpriseName: string;
  readonly mallName: string;
  readonly paidMinor: number;
  readonly paymentMethod: string;
  readonly benefitMinor: number;
  readonly wechatMinor: number;
  readonly supplierName: string;
  readonly fulfillmentId: string;
  readonly slaMinutes?: number;
  readonly addressSummary: string;
  readonly summary: string;
  readonly milestones: readonly OrderPreviewMilestone[];
  readonly operation?: OrderPreviewOperation;
  readonly exception: boolean;
}

export interface OrderPreviewRecord {
  readonly id: string;
  readonly order_number: string;
  readonly scope_id: string;
  readonly member_id: string;
  readonly mall_id: string;
  readonly total_minor: number;
  readonly currency: 'CNY';
  readonly payment_state: OrderPaymentState;
  readonly fulfillment_state: OrderFulfillmentState;
  readonly aftersale_state: OrderAftersaleState;
  readonly lifecycle_state: OrderLifecycleState;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
  readonly lines: readonly OrderPreviewLine[];
  readonly preview: OrderPreviewMetadata;
}

export interface OrderPreviewCounts {
  readonly all: number;
  readonly unpaid: number;
  readonly unshipped: number;
  readonly active: number;
  readonly completed: number;
  readonly aftersale: number;
  readonly exception: number;
}

export interface OrderPreviewPage {
  readonly items: readonly OrderPreviewRecord[];
  readonly count: number;
  readonly nextCursor?: string;
  readonly preview: {
    readonly source: typeof ORDER_PREVIEW_SOURCE;
    readonly total: number;
    readonly updatedAt: string;
    readonly page: number;
    readonly previousCursor?: string;
    readonly counts: OrderPreviewCounts;
  };
}

export class OrderPreviewQueryError extends Error {
  readonly status = 400;
  readonly code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID';

  constructor(code: 'PREVIEW_LIMIT_INVALID' | 'PREVIEW_CURSOR_INVALID') {
    super(code);
    this.name = 'OrderPreviewQueryError';
    this.code = code;
  }
}

interface OrderSeed {
  readonly orderNumber: string;
  readonly memberName: string;
  readonly enterpriseName: string;
  readonly mall: 'huimin' | 'zhenxuan';
  readonly productTitle: string;
  readonly sku: string;
  readonly totalMinor: number;
  readonly paidMinor: number;
  readonly paymentState: OrderPaymentState;
  readonly fulfillmentState: OrderFulfillmentState;
  readonly aftersaleState: OrderAftersaleState;
  readonly lifecycleState: OrderLifecycleState;
  readonly createdAt: string;
  readonly slaMinutes?: number;
  readonly operationLabel?: string;
  readonly waitMinutes?: number;
  readonly exception: boolean;
}

const referenceSeeds: readonly OrderSeed[] = Object.freeze([
  seed({
    orderNumber: 'SW202608240001',
    memberName: '张莉',
    enterpriseName: '鸿泰科技有限公司',
    mall: 'huimin',
    productTitle: '五常大米礼盒',
    sku: 'SKU-MVP-RICE-10KG',
    totalMinor: 9_800,
    paidMinor: 9_800,
    paymentState: 'paid',
    fulfillmentState: 'allocated',
    aftersaleState: 'none',
    lifecycleState: 'active',
    createdAt: '2026-08-24T12:42:00.000Z',
    slaMinutes: 18,
    operationLabel: '发货任务超过 SLA',
    waitMinutes: 18,
    exception: true,
  }),
  seed({
    orderNumber: 'SW202608240002',
    memberName: '王磊',
    enterpriseName: '鸿泰建设集团',
    mall: 'zhenxuan',
    productTitle: '九阳5.5L大容量可视空气炸锅',
    sku: 'SKU-MVP-AIR-FRYER',
    totalMinor: 21_900,
    paidMinor: 0,
    paymentState: 'unpaid',
    fulfillmentState: 'unallocated',
    aftersaleState: 'none',
    lifecycleState: 'created',
    createdAt: '2026-08-24T12:08:00.000Z',
    operationLabel: '渠道状态等待同步',
    waitMinutes: 8,
    exception: true,
  }),
  seed({
    orderNumber: 'SW202608240003',
    memberName: '李敏',
    enterpriseName: '鸿泰数字科技',
    mall: 'huimin',
    productTitle: '罗技G610红轴机械键盘',
    sku: 'SKU-MVP-KEYBOARD',
    totalMinor: 35_900,
    paidMinor: 35_900,
    paymentState: 'paid',
    fulfillmentState: 'processing',
    aftersaleState: 'none',
    lifecycleState: 'active',
    createdAt: '2026-08-24T11:36:00.000Z',
    operationLabel: '佣金归因等待确认',
    waitMinutes: 5,
    exception: true,
  }),
  seed({
    orderNumber: 'SW202608230004',
    memberName: '周晴',
    enterpriseName: '鸿泰物业服务',
    mall: 'zhenxuan',
    productTitle: '星巴克100元电子星礼卡',
    sku: 'SKU-MVP-COFFEE-CARD',
    totalMinor: 9_800,
    paidMinor: 9_800,
    paymentState: 'paid',
    fulfillmentState: 'delivered',
    aftersaleState: 'none',
    lifecycleState: 'completed',
    createdAt: '2026-08-23T09:18:00.000Z',
  }),
  seed({
    orderNumber: 'SW202608220005',
    memberName: '陈晓',
    enterpriseName: '鸿泰金融服务',
    mall: 'huimin',
    productTitle: '明前特级西湖龙井茶礼盒',
    sku: 'SKU-MVP-TEA',
    totalMinor: 36_000,
    paidMinor: 36_000,
    paymentState: 'paid',
    fulfillmentState: 'shipped',
    aftersaleState: 'requested',
    lifecycleState: 'active',
    createdAt: '2026-08-22T08:52:00.000Z',
    operationLabel: '售后工单等待回写',
    waitMinutes: 3,
    exception: true,
  }),
  seed({
    orderNumber: 'SW202608210006',
    memberName: '赵晨',
    enterpriseName: '鸿泰能源有限公司',
    mall: 'zhenxuan',
    productTitle: '每日坚果企业福利礼盒',
    sku: 'SKU-MVP-NUTS',
    totalMinor: 10_800,
    paidMinor: 7_800,
    paymentState: 'partially_refunded',
    fulfillmentState: 'returned',
    aftersaleState: 'processing',
    lifecycleState: 'active',
    createdAt: '2026-08-21T07:46:00.000Z',
    operationLabel: '退款对账等待确认',
    waitMinutes: 32,
    exception: true,
  }),
  seed({
    orderNumber: 'SW202608180007',
    memberName: '孙悦',
    enterpriseName: '鸿泰城市运营',
    mall: 'huimin',
    productTitle: '企业员工健康体检套餐',
    sku: 'SKU-MVP-HEALTH',
    totalMinor: 68_000,
    paidMinor: 0,
    paymentState: 'refunded',
    fulfillmentState: 'delivered',
    aftersaleState: 'resolved',
    lifecycleState: 'completed',
    createdAt: '2026-08-18T06:30:00.000Z',
    operationLabel: '退款结果投影等待确认',
    waitMinutes: 2,
    exception: true,
  }),
]);

export const orderPreviewOrders: readonly OrderPreviewRecord[] = Object.freeze(referenceSeeds.map((value, index) => orderRecord(index, value)));

export const orderPaginationOrders: readonly OrderPreviewRecord[] = Object.freeze([
  ...orderPreviewOrders,
  ...Array.from({ length: ORDER_PREVIEW_TOTAL - orderPreviewOrders.length }, (_, index) => {
    const absoluteIndex = index + orderPreviewOrders.length;
    return orderRecord(absoluteIndex, generatedSeed(absoluteIndex));
  }),
]);

export function orderPreviewPage(search: URLSearchParams, rows: readonly OrderPreviewRecord[] = orderPreviewOrders): OrderPreviewPage {
  const query = Object.freeze({
    order: textQuery(search, 'order').toLowerCase(),
    placed: textQuery(search, 'placed'),
    lifecycle: textQuery(search, 'lifecycle'),
    payment: textQuery(search, 'payment'),
    fulfillment: textQuery(search, 'fulfillment'),
    mall: textQuery(search, 'mall'),
    view: viewQuery(search),
    limit: limitQuery(search),
  });
  const fingerprint = JSON.stringify(query);
  const offset = cursorOffset(search.get('cursor'), fingerprint);
  const base = rows.filter((row) => matchesFilters(row, query));
  const filtered = base.filter((row) => matchesView(row, query.view));
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
      source: ORDER_PREVIEW_SOURCE,
      total: filtered.length,
      updatedAt: ORDER_PREVIEW_UPDATED_AT,
      page: Math.floor(offset / query.limit) + 1,
      ...(previousCursor === undefined ? {} : { previousCursor }),
      counts: countViews(base),
    }),
  });
}

function seed(value: Omit<OrderSeed, 'exception'> & Partial<Pick<OrderSeed, 'exception'>>): OrderSeed {
  return Object.freeze({ exception: false, ...value });
}

function generatedSeed(index: number): OrderSeed {
  const number = index + 1;
  const paymentStates: readonly OrderPaymentState[] = ['paid', 'paid', 'paid', 'unpaid', 'partially_refunded', 'failed'];
  const fulfillmentStates: readonly OrderFulfillmentState[] = ['allocated', 'processing', 'shipped', 'delivered', 'unallocated', 'returned'];
  const aftersaleStates: readonly OrderAftersaleState[] = ['none', 'none', 'none', 'none', 'requested', 'processing'];
  const paymentState = paymentStates[index % paymentStates.length]!;
  const fulfillmentState = fulfillmentStates[index % fulfillmentStates.length]!;
  const aftersaleState = aftersaleStates[index % aftersaleStates.length]!;
  const lifecycleState: OrderLifecycleState = fulfillmentState === 'delivered' ? 'completed' : paymentState === 'unpaid' ? 'created' : 'active';
  const price = 3_900 + (index % 240) * 100;
  return seed({
    orderNumber: `SW-PREVIEW-${String(number).padStart(5, '0')}`,
    memberName: `预览会员 ${String(number).padStart(4, '0')}`,
    enterpriseName: index % 2 === 0 ? '鸿泰科技有限公司' : '鸿泰建设集团',
    mall: index % 2 === 0 ? 'huimin' : 'zhenxuan',
    productTitle: `服务端订单商品 ${String(number).padStart(4, '0')}`,
    sku: `SKU-PREVIEW-${String(number).padStart(5, '0')}`,
    totalMinor: price,
    paidMinor: paymentState === 'unpaid' || paymentState === 'failed' ? 0 : price,
    paymentState,
    fulfillmentState,
    aftersaleState,
    lifecycleState,
    createdAt: `2026-08-${String(24 - (index % 20)).padStart(2, '0')}T${String(12 - (index % 10)).padStart(2, '0')}:00:00.000Z`,
    ...(fulfillmentState === 'allocated' ? { slaMinutes: 12 + (index % 40) } : {}),
    exception: paymentState === 'failed' || fulfillmentState === 'returned',
  });
}

function orderRecord(index: number, value: OrderSeed): OrderPreviewRecord {
  const serial = String(index + 1).padStart(5, '0');
  const id = `order:preview:${serial}`;
  const mallName = value.mall === 'huimin' ? '鸿泰惠民通' : '鸿泰甄选';
  const paidAt = new Date(new Date(value.createdAt).getTime() + 4 * 60_000).toISOString();
  const updatedAt = new Date(new Date(value.createdAt).getTime() + 22 * 60_000).toISOString();
  const operationAt = value.exception && value.waitMinutes !== undefined ? new Date(new Date(ORDER_PREVIEW_UPDATED_AT).getTime() - value.waitMinutes * 60_000).toISOString() : updatedAt;
  const benefitMinor = Math.min(value.paidMinor, Math.floor(value.paidMinor * 0.4));
  const milestones = milestonesFor(value, paidAt, updatedAt);
  return Object.freeze({
    id,
    order_number: value.orderNumber,
    scope_id: 'platform:preview',
    member_id: `member:preview:${serial}`,
    mall_id: `mall:${value.mall}`,
    total_minor: value.totalMinor,
    currency: 'CNY',
    payment_state: value.paymentState,
    fulfillment_state: value.fulfillmentState,
    aftersale_state: value.aftersaleState,
    lifecycle_state: value.lifecycleState,
    created_at: value.createdAt,
    updated_at: updatedAt,
    version: 12 + (index % 5),
    lines: Object.freeze([
      Object.freeze({
        id: `line:preview:${serial}:1`,
        sku: value.sku,
        listing: `listing:preview:${serial}`,
        title: value.productTitle,
        quantity: 1,
        unitMinor: value.totalMinor,
        totalMinor: value.totalMinor,
        discountMinor: 0,
        payableMinor: value.totalMinor,
        provider: '央企供应链',
        partner: null,
      }),
    ]),
    preview: Object.freeze({
      source: ORDER_PREVIEW_SOURCE,
      memberName: value.memberName,
      enterpriseName: value.enterpriseName,
      mallName,
      paidMinor: value.paidMinor,
      paymentMethod: value.paymentState === 'unpaid' ? '待付款' : value.paymentState === 'failed' ? '支付失败' : '福利账户 + 微信支付',
      benefitMinor,
      wechatMinor: value.paidMinor - benefitMinor,
      supplierName: '央企供应链',
      fulfillmentId: `fulfillment:preview:${serial}`,
      ...(value.slaMinutes === undefined ? {} : { slaMinutes: value.slaMinutes }),
      addressSummary: `上海市浦东新区 · ${value.memberName} · 138****${serial.slice(-4)}`,
      summary: `${value.memberName}通过${mallName}下单，订单、支付与履约状态已按本地预览快照对齐。`,
      milestones,
      operation: Object.freeze({
        id: `OP-240824-${String(1_185 + index).padStart(4, '0')}`,
        label: value.operationLabel ?? (value.exception ? '履约异常等待人工核对' : '订单快照读取完成'),
        status: value.exception ? 'failed' : 'succeeded',
        at: operationAt,
      }),
      exception: value.exception,
    }),
  });
}

function milestonesFor(value: OrderSeed, paidAt: string, updatedAt: string): readonly OrderPreviewMilestone[] {
  const paid = !['unpaid', 'authorizing', 'failed'].includes(value.paymentState);
  const reserved = !['unallocated', 'cancelled'].includes(value.fulfillmentState);
  const shipped = ['shipped', 'delivered', 'returned'].includes(value.fulfillmentState);
  const completed = value.lifecycleState === 'completed';
  return Object.freeze([
    milestone('placed', '下单', 'complete', value.createdAt),
    milestone('paid', '支付', paid ? 'complete' : 'current', paid ? paidAt : undefined),
    milestone('reserved', '库存锁定', reserved ? 'complete' : 'pending', reserved ? paidAt : undefined),
    milestone('unshipped', '待发货', reserved ? (shipped ? 'complete' : 'current') : 'pending', reserved ? updatedAt : undefined),
    milestone('shipping', '待收货', shipped ? (completed ? 'complete' : 'current') : 'pending', shipped ? updatedAt : undefined),
    milestone('completed', '完成', completed ? 'complete' : value.exception ? 'warning' : 'pending', completed ? updatedAt : undefined),
  ]);
}

function milestone(key: OrderPreviewMilestone['key'], label: string, state: OrderMilestoneState, at: string | undefined): OrderPreviewMilestone {
  return Object.freeze({ key, label, state, ...(at === undefined ? {} : { at }) });
}

function matchesFilters(
  row: OrderPreviewRecord,
  query: Readonly<{
    order: string;
    placed: string;
    lifecycle: string;
    payment: string;
    fulfillment: string;
    mall: string;
  }>
): boolean {
  const lineText = row.lines.map((line) => `${line.title}\n${line.sku}`).join('\n');
  const searchable = `${row.id}\n${row.order_number}\n${row.member_id}\n${row.preview.memberName}\n${row.preview.enterpriseName}\n${lineText}`.toLowerCase();
  return (
    (query.order === '' || searchable.includes(query.order)) &&
    matchesPlaced(row.created_at, query.placed) &&
    (query.lifecycle === '' || row.lifecycle_state === query.lifecycle) &&
    (query.payment === '' || row.payment_state === query.payment) &&
    (query.fulfillment === '' || row.fulfillment_state === query.fulfillment) &&
    (query.mall === '' || row.mall_id === `mall:${query.mall}`)
  );
}

function matchesPlaced(createdAt: string, placed: string): boolean {
  if (placed === '') return true;
  const age = new Date(ORDER_PREVIEW_UPDATED_AT).getTime() - new Date(createdAt).getTime();
  if (placed === 'today') return age >= 0 && age < 24 * 60 * 60 * 1_000;
  if (placed === '7days') return age >= 0 && age < 7 * 24 * 60 * 60 * 1_000;
  if (placed === '30days') return age >= 0 && age < 30 * 24 * 60 * 60 * 1_000;
  return false;
}

function matchesView(row: OrderPreviewRecord, view: OrderView): boolean {
  if (view === 'all') return true;
  if (view === 'unpaid') return row.payment_state === 'unpaid';
  if (view === 'unshipped') return row.fulfillment_state === 'allocated';
  if (view === 'active') return row.fulfillment_state === 'processing' || row.fulfillment_state === 'shipped';
  if (view === 'completed') return row.lifecycle_state === 'completed';
  if (view === 'aftersale') return row.aftersale_state !== 'none' || ['partially_refunded', 'refunded'].includes(row.payment_state);
  return row.preview.exception;
}

function countViews(rows: readonly OrderPreviewRecord[]): OrderPreviewCounts {
  const count = (view: OrderView) => rows.filter((row) => matchesView(row, view)).length;
  return Object.freeze({
    all: rows.length,
    unpaid: count('unpaid'),
    unshipped: count('unshipped'),
    active: count('active'),
    completed: count('completed'),
    aftersale: count('aftersale'),
    exception: count('exception'),
  });
}

function textQuery(search: URLSearchParams, key: string): string {
  return (search.get(key) ?? '').trim().slice(0, 255);
}

function viewQuery(search: URLSearchParams): OrderView {
  const value = search.get('view') ?? 'all';
  return ['all', 'unpaid', 'unshipped', 'active', 'completed', 'aftersale', 'exception'].includes(value) ? (value as OrderView) : 'all';
}

function limitQuery(search: URLSearchParams): number {
  const raw = search.get('limit');
  const value = raw === null ? 50 : Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new OrderPreviewQueryError('PREVIEW_LIMIT_INVALID');
  return value;
}

function cursorOffset(cursor: string | null, fingerprint: string): number {
  if (cursor === null) return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!isCursor(parsed) || parsed.fingerprint !== fingerprint) throw new Error('CURSOR_MISMATCH');
    return parsed.offset;
  } catch {
    throw new OrderPreviewQueryError('PREVIEW_CURSOR_INVALID');
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
