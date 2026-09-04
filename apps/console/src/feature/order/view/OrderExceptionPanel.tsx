import { useMemo, useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { OrderDetailTab, OrderRecord, OrderRecoveryState } from '../model/Order';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, formatOrderTime, fulfillmentLabel, lifecycleLabel, paymentLabel, recoveryLabel } from './OrderPresentation';

type ExceptionKind = 'payment' | 'fulfillment' | 'aftersale' | 'source';
type ExceptionFilter = 'all' | ExceptionKind;
type ExceptionTone = 'danger' | 'warning' | 'neutral';

interface ExceptionFact {
  readonly kind: ExceptionKind;
  readonly label: string;
  readonly description: string;
  readonly tone: ExceptionTone;
  readonly tab: OrderDetailTab;
}

interface ExceptionItem {
  readonly order: OrderRecord;
  readonly primary: ExceptionFact;
  readonly facts: readonly ExceptionFact[];
}

const filters: readonly Readonly<{ value: ExceptionFilter; label: string }>[] = [
  { value: 'all', label: '全部异常' },
  { value: 'payment', label: '支付' },
  { value: 'fulfillment', label: '履约' },
  { value: 'aftersale', label: '售后' },
  { value: 'source', label: '渠道核验' },
];

export function OrderExceptionPanel({ rows, recoveries, onOpen, onRetry }: Readonly<{
  rows: readonly OrderRecord[];
  recoveries: OrderRecoveryState;
  onOpen: (id: string, tab: OrderDetailTab) => void;
  onRetry: () => void;
}>) {
  const [filter, setFilter] = useState<ExceptionFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = useMemo(() => rows.map(toExceptionItem), [rows]);
  const visible = filter === 'all' ? items : items.filter((item) => item.facts.some((fact) => fact.kind === filter));
  const selected = visible.find((item) => item.order.id === selectedId) ?? visible[0];
  const paymentCount = items.filter((item) => hasKind(item, 'payment')).length;
  const fulfillmentCount = items.filter((item) => hasKind(item, 'fulfillment')).length;
  const sourceCount = items.filter((item) => hasKind(item, 'source')).length;

  return (
    <div className="orderexceptionstack" role="region" aria-label="订单异常工作台">
      <header className="orderexceptionintro">
        <div><span className="ordersectioneyebrow">订单协同异常</span><h2>先确认真实异常，再进入对应分区恢复</h2><p>这里仅组织服务端返回的订单、支付恢复、履约、售后与渠道核验事实，不在浏览器内推断超时、责任人或处理结果。</p></div>
        <ol aria-label="异常处理步骤"><li><span>1</span><strong>找到异常</strong></li><li><span>2</span><strong>核对权威事实</strong></li><li><span>3</span><strong>进入恢复分区</strong></li></ol>
      </header>

      <section className="orderexceptionmetrics" aria-label="异常概览">
        <article><span>异常订单</span><strong>{items.length}</strong><small>当前服务端筛选范围</small></article>
        <article><span>支付失败</span><strong>{paymentCount}</strong><small>{recoverySummary(recoveries)}</small></article>
        <article><span>履约异常</span><strong>{fulfillmentCount}</strong><small>含取消、退回与订单取消</small></article>
        <article><span>独立来源异常</span><strong>{sourceCount}</strong><small>由服务端异常条件识别</small></article>
      </section>

      <section className="orderexceptionworkbench" aria-label="异常订单事实">
        <aside>
          <header><div><h3>异常队列</h3><p>按异常类型快速收窄</p></div><strong>{visible.length} 单</strong></header>
          <div className="orderexceptionfilters" aria-label="异常类型筛选">
            {filters.map((item) => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
          </div>
          {visible.length === 0 ? <div className="orderexceptionempty"><OrderIcon name="order" /><strong>此分类暂无异常订单</strong><p>可切换其他异常类型继续处理。</p></div> : null}
          <div className="orderexceptionlist" role="list" aria-label="异常订单队列">
            {visible.map((item) => (
              <button type="button" role="listitem" className={item.order.id === selected?.order.id ? 'isselected' : undefined} key={item.order.id} onClick={() => setSelectedId(item.order.id)}>
                <span><strong>{item.order.order_number}</strong><small>{formatOrderTime(item.order.updated_at)}</small></span>
                <span><span className={`orderstatuspill tone-${item.primary.tone}`}>{item.primary.label}</span><small>{item.facts.length > 1 ? `另有 ${item.facts.length - 1} 项异常事实` : '单项异常事实'}</small></span>
              </button>
            ))}
          </div>
        </aside>
        {selected ? <ExceptionDetail item={selected} onOpen={onOpen} /> : <div className="orderexceptionempty"><OrderIcon name="order" /><strong>没有可查看的异常事实</strong><p>当前筛选范围内没有异常订单。</p></div>}
      </section>

      {recoveries.state === 'hidden' ? null : (
        <section className="orderexceptionrecovery" aria-labelledby="paymentrecoverytitle">
          <header><div><h3 id="paymentrecoverytitle">支付渠道恢复事项</h3><p>直接来自支付恢复读模型，与订单异常事实分开呈现。</p></div>{recoveries.state === 'ready' ? <strong>{recoveries.data.count} 项</strong> : null}</header>
          {recoveries.state === 'loading' ? <p role="status">正在读取支付恢复事项…</p> : null}
          {recoveries.state === 'unavailable' ? <div className="orderexceptionerror" role="alert"><strong>支付恢复数据暂时不可用</strong><p>{recoveries.error.message}</p>{recoveries.error.traceId ? <small>请求追踪：{recoveries.error.traceId}</small> : null}{recoveries.error.retryable ? <button type="button" onClick={onRetry}>仅重试异常数据</button> : null}</div> : null}
          {recoveries.state === 'ready' && recoveries.data.items.length === 0 ? <p>当前范围没有支付恢复事项。</p> : null}
          {recoveries.state === 'ready' ? <div className="orderexceptiongrid">{recoveries.data.items.map((recovery) => <article key={recovery.id}><header><span className={`orderstatuspill tone-${recovery.severity === 'critical' ? 'danger' : 'warning'}`}>{recovery.severity === 'critical' ? '紧急恢复' : '高优先级'}</span><small>{formatOrderTime(recovery.openedAt)}</small></header><h3>{recovery.orderNumber ?? '未关联业务订单号'}</h3><p>{recoveryLabel(recovery.errorCode)} · 已出现 {recovery.occurrenceCount} 次 · {chineseDomainLabel(recovery.state)}</p>{recovery.orderId ? <button type="button" onClick={() => onOpen(recovery.orderId!, 'payment')}>进入支付分区处理</button> : <small>该事项未关联订单，请前往财务恢复中心处理。</small>}<small>{chineseReference('恢复事项', recovery.id)}</small></article>)}</div> : null}
        </section>
      )}
    </div>
  );
}

function ExceptionDetail({ item, onOpen }: Readonly<{ item: ExceptionItem; onOpen: (id: string, tab: OrderDetailTab) => void }>) {
  const order = item.order;
  const latestMilestone = [...order.fulfillments].flatMap((fulfillment) => fulfillment.milestones).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  return (
    <article className="orderexceptiondetail">
      <header><div><span className="ordersectioneyebrow">当前选中订单</span><h3>{order.order_number}</h3></div><small>更新于 {formatOrderTime(order.updated_at)}</small></header>
      <section><h4>异常事实</h4><div className="orderexceptionfacts">{item.facts.map((fact) => <article key={fact.kind}><span className={`orderstatuspill tone-${fact.tone}`}>{fact.label}</span><p>{fact.description}</p><button type="button" onClick={() => onOpen(order.id, fact.tab)}>进入{tabLabel(fact.tab)}分区</button></article>)}</div></section>
      <section><h4>权威状态</h4><dl className="orderexceptionstates"><div><dt>支付</dt><dd>{paymentLabel(order.payment_state)}</dd></div><div><dt>履约</dt><dd>{fulfillmentLabel(order.fulfillment_state)}</dd></div><div><dt>售后</dt><dd>{aftersaleLabel(order.aftersale_state)}</dd></div><div><dt>订单</dt><dd>{lifecycleLabel(order.lifecycle_state)}</dd></div><div><dt>来源异常</dt><dd>{hasKind(item, 'source') ? '服务端异常条件已识别' : '请在订单概览核对'}</dd></div><div><dt>最近履约节点</dt><dd>{latestMilestone ? `${chineseDomainLabel(latestMilestone.kind, '履约节点')} · ${formatOrderTime(latestMilestone.occurredAt)}` : '尚无履约节点'}</dd></div></dl></section>
      <footer><span>订单版本：第 {order.version} 版</span><span>{chineseReference('内部订单', order.id)}</span></footer>
    </article>
  );
}

function toExceptionItem(order: OrderRecord): ExceptionItem {
  const facts: ExceptionFact[] = [];
  if (order.payment_state === 'failed') facts.push({ kind: 'payment', label: '支付失败', description: '支付事实未完成，请核对失败记录与支付渠道恢复事项。', tone: 'danger', tab: 'payment' });
  if (order.fulfillment_state === 'cancelled' || order.fulfillment_state === 'returned') facts.push({ kind: 'fulfillment', label: '履约异常', description: `当前履约状态为“${fulfillmentLabel(order.fulfillment_state)}”，请核对履约节点及相关退货事实。`, tone: 'warning', tab: 'products' });
  if (order.lifecycle_state === 'cancelled' && !facts.some((fact) => fact.kind === 'fulfillment')) facts.push({ kind: 'fulfillment', label: '订单已取消', description: '订单生命周期已取消，请核对支付、履约与退款事实是否完整闭环。', tone: 'warning', tab: 'overview' });
  if (order.aftersale_state === 'reviewing' || order.aftersale_state === 'refunding') facts.push({ kind: 'aftersale', label: order.aftersale_state === 'reviewing' ? '售后待审核' : '退款处理中', description: `当前售后状态为“${aftersaleLabel(order.aftersale_state)}”，请进入售后分区完成后续处理。`, tone: 'warning', tab: 'aftersale' });
  if (facts.length === 0) facts.push({ kind: 'source', label: '来源待核验', description: '服务端异常条件已识别来源核验问题，请进入概览核对渠道来源事实；核验完成前不可继续履约、开票或结算。', tone: 'danger', tab: 'overview' });
  const primary = facts[0]!;
  return { order, primary, facts: facts.length > 0 ? facts : [primary] };
}

function hasKind(item: ExceptionItem, kind: ExceptionKind): boolean {
  return item.facts.some((fact) => fact.kind === kind);
}

function recoverySummary(state: OrderRecoveryState): string {
  if (state.state === 'ready') return `${state.data.count} 项支付恢复事项`;
  if (state.state === 'unavailable') return '支付恢复数据暂不可用';
  if (state.state === 'loading') return '正在读取支付恢复事项';
  return '按订单支付事实统计';
}

function tabLabel(tab: OrderDetailTab): string {
  return ({ overview: '概览', products: '商品与履约', payment: '支付', aftersale: '售后', finance: '财务', support: '客服', operations: '审计' } as const)[tab];
}
