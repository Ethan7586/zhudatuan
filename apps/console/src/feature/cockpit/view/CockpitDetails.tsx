import { formatCount, formatDate, formatMinor } from '../../../shared/ui/Format';
import type { BusinessEvent, BusinessInsight, CategoryPerformance, CockpitData, MallPerformance } from '../model/Cockpit';

export function CategoryBreakdown({ categories }: Readonly<{ categories: readonly CategoryPerformance[] }>) {
  return <section className="cockpitcard categorybreakdown"><h2>分类销售占比</h2>{categories.length === 0 ? <p className="cockpitempty">暂无分类销售数据</p> : <div className="categorylist">{categories.map((category) => <article key={category.name}><div><strong>{category.name}</strong><span>{formatMinor(category.salesCents)}</span><b>{formatShare(category.share)}</b></div><div className="categorytrack" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, normalizedShare(category.share)))}%` }} /></div></article>)}</div>}</section>;
}

export function MallComparison({ malls }: Readonly<{ malls: readonly MallPerformance[] }>) {
  const maximum = Math.max(...malls.map((mall) => mall.salesCents), 1);
  return <section className="cockpitcard mallcomparison"><h2>商城经营对比</h2><div className="mallhead"><span>商城</span><span>净成交额</span><span>支付单</span><span>退款率</span></div>{malls.length === 0 ? <p className="cockpitempty">当前范围暂无商城对比数据</p> : malls.map((mall) => <article key={mall.id}><div className="mallrow"><strong>{mall.name}</strong><span>{formatMinor(mall.salesCents)}</span><span>{formatCount(mall.paidOrderCount)}</span><span className={mall.refundRate >= 0.04 ? 'isnegative' : ''}>{formatShare(mall.refundRate)}</span></div><div className="malltrack" aria-hidden="true"><i style={{ width: `${Math.max(4, (mall.salesCents / maximum) * 100)}%` }} /></div></article>)}</section>;
}

export function BusinessEvents({ events, timezone }: Readonly<{ events: readonly BusinessEvent[]; timezone: string }>) {
  return <section className="cockpitcard businessevents"><h2>最近经营动态</h2><div className="eventhead"><span>事件</span><span>指标</span><span>时间</span></div>{events.length === 0 ? <p className="cockpitempty">暂无权威经营动态</p> : events.map((event) => <article key={event.id}><EventIcon kind={event.kind} /><strong>{event.title}</strong><span className={event.kind === 'warning' ? 'isnegative' : ''}>{event.metric}</span><time dateTime={event.time}>{formatDate(event.time)} · {timezone}</time></article>)}</section>;
}

export function BusinessInsights({ insights, onOpen }: Readonly<{ insights: readonly BusinessInsight[]; onOpen: (insight: BusinessInsight) => void }>) {
  return <section className="cockpitcard businessinsights"><h2>需要关注</h2>{insights.length === 0 ? <p className="cockpitempty">暂无服务端经营洞察</p> : insights.map((insight) => <article key={insight.id} data-tone={insight.tone}><InsightIcon tone={insight.tone} /><div><strong>{insight.title}</strong><span>{insight.detail}</span><button type="button" onClick={() => onOpen(insight)}>{insight.action} →</button></div></article>)}</section>;
}

export function OperationDetails({ summary }: Readonly<{ summary: CockpitData['summary'] }>) {
  const rows = [['目录商品', formatCount(summary.catalogCount)], ['可售库存', formatCount(summary.availableStock)], ['订单总数', formatCount(summary.orderCount)], ['售后总数', formatCount(summary.afterSaleCount)], ['上架商品', formatCount(summary.sales.activeProductCount)], ['已售商品', formatCount(summary.sales.soldProductCount)], ['未售上架商品', formatCount(summary.sales.unsoldActiveProductCount)], ['周期退款', formatMinor(summary.sales.refundedCents)]] as const;
  return <section className="cockpitcard operationdetails"><h2>经营明细</h2><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}

function EventIcon({ kind }: Readonly<{ kind: BusinessEvent['kind'] }>) { return <span className="eventicon" data-kind={kind} aria-hidden="true">{kind === 'warning' ? '!' : kind === 'sync' ? '↻' : '•'}</span>; }
function InsightIcon({ tone }: Readonly<{ tone: BusinessInsight['tone'] }>) { return <span className="insighticon" data-tone={tone} aria-hidden="true">{tone === 'warning' ? '!' : '↗'}</span>; }
function normalizedShare(value: number): number { return value <= 1 ? value * 100 : value; }
function formatShare(value: number): string { return `${normalizedShare(value).toFixed(1)}%`; }
