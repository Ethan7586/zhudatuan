import type { BusinessEvent, BusinessInsight, MallPerformance } from './CockpitSchema';

export function MallComparison({ malls }: Readonly<{ malls: readonly MallPerformance[] }>) {
  const maximum = Math.max(...malls.map((mall) => mall.salesCents), 1);
  return (
    <section className="cockpitcard mallcomparison" aria-labelledby="mallcomparisontitle">
      <h2 id="mallcomparisontitle">商城经营对比</h2>
      <div className="mallhead"><span>商城</span><span>净成交额</span><span>退款率</span></div>
<<<<<<< HEAD
      {malls.length === 0 ? <article>
        <div className="mallrow"><strong>全部商城</strong><span>{money(0)}</span><span>0.0%</span></div>
        <div className="malltrack" aria-hidden="true"><i style={{ width: '4%' }} /></div>
      </article> : malls.map((mall) => <article key={mall.id}>
=======
      {malls.length === 0 ? <p className="cockpitempty">暂无权威商城对比</p> : malls.map((mall) => <article key={mall.id}>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        <div className="mallrow"><strong>{mall.name}</strong><span>{money(mall.salesCents)}</span>
          <span className={mall.refundRate >= 0.04 ? 'isnegative' : ''}>{percent(mall.refundRate)}</span></div>
        <div className="malltrack" aria-hidden="true"><i style={{ width: `${Math.max(4, (mall.salesCents / maximum) * 100)}%` }} /></div>
      </article>)}
    </section>
  );
}

export function BusinessEvents({ events }: Readonly<{ events: readonly BusinessEvent[] }>) {
  return (
    <section className="cockpitcard businessevents" aria-labelledby="eventstitle">
      <h2 id="eventstitle">最近经营动态</h2>
      <div className="eventhead"><span>事件</span><span>指标</span><span>时间</span></div>
<<<<<<< HEAD
      {events.length === 0 ? <article>
        <EventIcon kind="calendar" /><strong>经营动态</strong><span>0 条</span><time>—</time>
      </article> : events.map((event) => <article key={event.id}>
=======
      {events.length === 0 ? <p className="cockpitempty">暂无权威经营动态</p> : events.map((event) => <article key={event.id}>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        <EventIcon kind={event.kind} /><strong>{event.title}</strong><span className={event.kind === 'warning' ? 'isnegative' : ''}>{event.metric}</span><time>{event.time}</time>
      </article>)}
    </section>
  );
}

export function BusinessInsights({ insights, onOpen }: Readonly<{
  insights: readonly BusinessInsight[];
  onOpen: (insight: BusinessInsight) => void;
}>) {
  return (
    <section className="cockpitcard businessinsights" aria-labelledby="insightstitle">
      <h2 id="insightstitle">需要关注</h2>
<<<<<<< HEAD
      {insights.length === 0 ? <article data-tone="positive">
        <InsightIcon tone="positive" />
        <div><strong>需要关注 0 项</strong><span>当前周期没有需要处理的经营洞察</span></div>
      </article> : insights.map((insight) => <article key={insight.id} data-tone={insight.tone}>
=======
      {insights.length === 0 ? <p className="cockpitempty">暂无服务端经营洞察</p> : insights.map((insight) => <article key={insight.id} data-tone={insight.tone}>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        <InsightIcon tone={insight.tone} />
        <div><strong>{insight.title}</strong>{insight.detail === undefined ? null : <span>{insight.detail}</span>}
          <button type="button" onClick={() => onOpen(insight)}>{insight.action} →</button></div>
      </article>)}
    </section>
  );
}

function EventIcon({ kind }: Readonly<{ kind: BusinessEvent['kind'] }>) {
  if (kind === 'warning') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>;
  if (kind === 'sync') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M18.2 9A7 7 0 0 0 6 6.8L4 9m2 6a7 7 0 0 0 12 2.2L20 15" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></svg>;
}

function InsightIcon({ tone }: Readonly<{ tone: BusinessInsight['tone'] }>) {
  return tone === 'warning'
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 6-6 4 4 6-8" /><path d="M15 7h5v5" /></svg>;
}

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value / 100);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
