import type { OrderDetailTab, OrderRecord, OrderRecoveryState } from '../model/Order';
import { aftersaleLabel, fulfillmentLabel } from './OrderPresentation';

export type ExceptionKind = 'payment' | 'fulfillment' | 'aftersale' | 'source';
export type ExceptionFilter = 'all' | ExceptionKind;
export type ExceptionTone = 'danger' | 'warning' | 'neutral';

export interface ExceptionFact {
  readonly kind: ExceptionKind;
  readonly label: string;
  readonly description: string;
  readonly tone: ExceptionTone;
  readonly tab: OrderDetailTab;
}

export interface ExceptionItem {
  readonly order: OrderRecord;
  readonly primary: ExceptionFact;
  readonly facts: readonly ExceptionFact[];
}

export const exceptionFilters: readonly Readonly<{ value: ExceptionFilter; label: string }>[] = [
  { value: 'all', label: '全部异常' },
  { value: 'payment', label: '支付' },
  { value: 'fulfillment', label: '履约' },
  { value: 'aftersale', label: '售后' },
  { value: 'source', label: '渠道核验' },
];

export function toExceptionItem(order: OrderRecord): ExceptionItem {
  const facts: ExceptionFact[] = [];
  if (order.payment_state === 'failed') facts.push({ kind: 'payment', label: '支付失败', description: '支付事实未完成，请核对失败记录与支付渠道恢复事项。', tone: 'danger', tab: 'payment' });
  if (order.fulfillment_state === 'cancelled' || order.fulfillment_state === 'returned')
    facts.push({ kind: 'fulfillment', label: '履约异常', description: `当前履约状态为“${fulfillmentLabel(order.fulfillment_state)}”，请核对履约节点及相关退货事实。`, tone: 'warning', tab: 'products' });
  if (order.lifecycle_state === 'cancelled' && !facts.some((fact) => fact.kind === 'fulfillment'))
    facts.push({ kind: 'fulfillment', label: '订单已取消', description: '订单生命周期已取消，请核对支付、履约与退款事实是否完整闭环。', tone: 'warning', tab: 'overview' });
  if (order.aftersale_state === 'reviewing' || order.aftersale_state === 'refunding')
    facts.push({
      kind: 'aftersale',
      label: order.aftersale_state === 'reviewing' ? '售后待审核' : '退款处理中',
      description: `当前售后状态为“${aftersaleLabel(order.aftersale_state)}”，请进入售后分区完成后续处理。`,
      tone: 'warning',
      tab: 'aftersale',
    });
  if (facts.length === 0) facts.push({ kind: 'source', label: '来源待核验', description: '服务端异常条件已识别来源核验问题，请进入概览核对渠道来源事实；核验完成前不可继续履约、开票或结算。', tone: 'danger', tab: 'overview' });
  const primary = facts[0]!;
  return { order, primary, facts: facts.length > 0 ? facts : [primary] };
}

export function hasKind(item: ExceptionItem, kind: ExceptionKind): boolean {
  return item.facts.some((fact) => fact.kind === kind);
}

export function recoverySummary(state: OrderRecoveryState): string {
  if (state.state === 'ready') return `${state.data.count} 项支付恢复事项`;
  if (state.state === 'unavailable') return '支付恢复数据暂不可用';
  if (state.state === 'loading') return '正在读取支付恢复事项';
  if (state.state === 'locked') return '完成二次验证后查看';
  return '按订单支付事实统计';
}

export function tabLabel(tab: OrderDetailTab): string {
  return ({ overview: '概览', products: '商品与履约', payment: '支付', aftersale: '售后', finance: '财务', support: '客服', operations: '审计' } as const)[tab];
}
