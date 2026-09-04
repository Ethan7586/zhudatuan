import type { OrderRecord } from './OrderSchema';

export type IncidentKind = 'finance' | 'fulfillment' | 'channel' | 'referral' | 'support' | 'order';

export interface OrderIncident {
  readonly order: OrderRecord;
  readonly kind: IncidentKind;
  readonly title: string;
  readonly reason: string;
  readonly ownerSystem: string;
  readonly ownerRole: string;
  readonly actionLabel: string;
  readonly actionRoute: string;
  readonly lastEvent: string;
  readonly waitMinutes: number;
  readonly targetMinutes: number;
}

export interface TimelineStep {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly at?: string;
  readonly state: 'done' | 'pending' | 'current';
}

const INCIDENT_DETAILS: Readonly<Record<IncidentKind, Omit<OrderIncident, 'order' | 'kind' | 'waitMinutes'>>> = Object.freeze({
  finance: {
    title: '退款对账待确认',
    reason: '退款流程已完成，但账务确认尚未回写订单。',
    ownerSystem: '财务与对账台',
    ownerRole: '财务运营',
    actionLabel: '进入财务与对账台处理',
    actionRoute: 'finance/reconciliations',
    lastEvent: 'payment.refunded',
    targetMinutes: 15,
  },
  fulfillment: {
    title: '发货任务已超时',
    reason: '履约任务已经创建，但尚未收到发货结果回写。',
    ownerSystem: '履约服务',
    ownerRole: '履约运营',
    actionLabel: '进入待发货订单处理',
    actionRoute: 'orders?view=unshipped',
    lastEvent: 'fulfillment.created',
    targetMinutes: 15,
  },
  channel: {
    title: '渠道状态待同步',
    reason: '渠道侧状态已经变化，订单侧仍在等待同步结果。',
    ownerSystem: '渠道接入系统',
    ownerRole: '渠道运营',
    actionLabel: '进入渠道接入系统处理',
    actionRoute: 'channels',
    lastEvent: 'channel.sync.pending',
    targetMinutes: 15,
  },
  referral: {
    title: '佣金归因待确认',
    reason: '订单已满足归因条件，返佣关系尚未完成确认。',
    ownerSystem: '分销返佣系统',
    ownerRole: '分销运营',
    actionLabel: '进入分销返佣系统处理',
    actionRoute: 'referral',
    lastEvent: 'referral.attribution.pending',
    targetMinutes: 15,
  },
  support: {
    title: '售后工单待回写',
    reason: '售后工单已有处理结果，订单状态仍在等待回写。',
    ownerSystem: '客服系统',
    ownerRole: '客服运营',
    actionLabel: '进入客服系统处理',
    actionRoute: 'support',
    lastEvent: 'support.case.updated',
    targetMinutes: 15,
  },
  order: {
    title: '订单状态待核对',
    reason: '订单状态与协同系统回写结果不一致，需要人工核对。',
    ownerSystem: '订单管理系统',
    ownerRole: '订单运营',
    actionLabel: '查看完整订单详情',
    actionRoute: 'orders',
    lastEvent: 'order.state.mismatch',
    targetMinutes: 15,
  },
});

const MILESTONE_LABELS: Readonly<Record<string, Readonly<{ label: string; description: string }>>> = Object.freeze({
  placed: { label: '下单成功', description: '订单管理系统建立主订单' },
  paid: { label: '支付结果已确认', description: '支付状态已经写入订单' },
  reserved: { label: '库存预占完成', description: '商品治理台已经回写库存结果' },
  unshipped: { label: '履约任务已创建', description: '履约服务已经接收订单任务' },
  shipping: { label: '物流执行中', description: '订单等待履约结果回写' },
  completed: { label: '订单完成', description: '订单生命周期已经关闭' },
});

export function incidentFor(order: OrderRecord, referenceAt: string | undefined): OrderIncident {
  const label = order.preview?.source === 'local-preview' ? (order.preview.operation?.label ?? '') : '';
  const kind = incidentKind(label, order);
  return { order, kind, ...INCIDENT_DETAILS[kind], waitMinutes: waitingMinutes(order, referenceAt) };
}

export function timelineFor(incident: OrderIncident): readonly TimelineStep[] {
  const order = incident.order;
  const preview = order.preview?.source === 'local-preview' ? order.preview : undefined;
  if (incident.kind === 'finance') {
    return [
      { key: 'placed', label: '下单成功', description: '订单管理系统建立主订单', at: order.created_at, state: 'done' },
      { key: 'paid', label: '支付成功', description: '支付结果已经写入订单', at: milestoneAt(preview, 'paid') ?? order.created_at, state: 'done' },
      { key: 'reserved', label: '库存预占成功', description: '商品治理台 · SKU 库存已锁定', at: milestoneAt(preview, 'reserved') ?? order.created_at, state: 'done' },
      { key: 'returned', label: order.fulfillment_state === 'returned' ? '退货已签收' : '履约任务已完成', description: '履约服务已经回写执行结果', at: order.updated_at, state: 'done' },
      { key: 'aftersale', label: order.aftersale_state === 'resolved' ? '售后处理完成' : '售后申请已受理', description: '客服系统已经记录售后状态', at: order.updated_at, state: 'done' },
      { key: 'refund', label: order.payment_state === 'partially_refunded' ? '部分退款成功' : '退款成功', description: '原支付渠道已经返回退款结果', at: preview?.operation?.at ?? order.updated_at, state: 'done' },
      { key: 'exception', label: incident.title, description: incident.reason, state: 'current' },
    ];
  }
  const completed = (preview?.milestones ?? [])
    .filter((milestone) => milestone.state === 'complete')
    .map((milestone) => ({
      key: milestone.key,
      ...(MILESTONE_LABELS[milestone.key] ?? { label: milestone.label, description: '协同状态已经完成' }),
      ...(milestone.at === undefined ? {} : { at: milestone.at }),
      state: 'done' as const,
    }));
  return [...completed, { key: 'exception', label: incident.title, description: incident.reason, state: 'current' as const }];
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
}

export function formatClock(value: string | undefined): string {
  const time = parseTime(value);
  if (time === undefined) return '—';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(time);
}

function incidentKind(label: string, order: OrderRecord): IncidentKind {
  if (/退款|对账|账务/.test(label) || ['partially_refunded', 'refunded'].includes(order.payment_state)) return 'finance';
  if (/发货|履约|物流/.test(label)) return 'fulfillment';
  if (/渠道|同步/.test(label)) return 'channel';
  if (/佣金|返佣|归因/.test(label)) return 'referral';
  if (/售后|工单|客服/.test(label) || order.aftersale_state !== 'none') return 'support';
  return 'order';
}

function waitingMinutes(order: OrderRecord, referenceAt: string | undefined): number {
  const operationAt = order.preview?.source === 'local-preview' ? order.preview.operation?.at : undefined;
  const reference = parseTime(referenceAt);
  const started = parseTime(operationAt);
  if (reference !== undefined && started !== undefined && reference >= started) return Math.max(1, Math.round((reference - started) / 60_000));
  if (order.preview?.source === 'local-preview' && order.preview.slaMinutes !== undefined) return Math.max(1, order.preview.slaMinutes);
  return 1;
}

function milestoneAt(preview: OrderRecord['preview'] | undefined, key: string): string | undefined {
  return preview?.milestones.find((milestone) => milestone.key === key)?.at;
}

function parseTime(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}
