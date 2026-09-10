import { useMemo, useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { OrderDetailTab, OrderRecord, OrderRecoveryState } from '../model/Order';
import { OrderIcon } from './OrderIcon';
import { formatOrderTime, recoveryLabel } from './OrderPresentation';

import { ExceptionDetail } from './OrderExceptionDetail';
import { exceptionFilters, hasKind, recoverySummary, toExceptionItem, type ExceptionFilter } from './OrderExceptionModel';
export function OrderExceptionPanel({
  rows,
  recoveries,
  onOpen,
  onRetry,
  onUnlock,
}: Readonly<{
  rows: readonly OrderRecord[];
  recoveries: OrderRecoveryState;
  onOpen: (id: string, tab: OrderDetailTab) => void;
  onRetry: () => void;
  onUnlock: () => void;
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
        <div>
          <span className="ordersectioneyebrow">订单协同异常</span>
          <h2>先确认真实异常，再进入对应分区恢复</h2>
          <p>这里仅组织服务端返回的订单、支付恢复、履约、售后与渠道核验事实，不在浏览器内推断超时、责任人或处理结果。</p>
        </div>
        <ol aria-label="异常处理步骤">
          <li>
            <span>1</span>
            <strong>找到异常</strong>
          </li>
          <li>
            <span>2</span>
            <strong>核对权威事实</strong>
          </li>
          <li>
            <span>3</span>
            <strong>进入恢复分区</strong>
          </li>
        </ol>
      </header>

      <section className="orderexceptionmetrics" aria-label="异常概览">
        <article>
          <span>异常订单</span>
          <strong>{items.length}</strong>
          <small>当前服务端筛选范围</small>
        </article>
        <article>
          <span>支付失败</span>
          <strong>{paymentCount}</strong>
          <small>{recoverySummary(recoveries)}</small>
        </article>
        <article>
          <span>履约异常</span>
          <strong>{fulfillmentCount}</strong>
          <small>含取消、退回与订单取消</small>
        </article>
        <article>
          <span>独立来源异常</span>
          <strong>{sourceCount}</strong>
          <small>由服务端异常条件识别</small>
        </article>
      </section>

      <section className="orderexceptionworkbench" aria-label="异常订单事实">
        <aside>
          <header>
            <div>
              <h3>异常队列</h3>
              <p>按异常类型快速收窄</p>
            </div>
            <strong>{visible.length} 单</strong>
          </header>
          <div className="orderexceptionfilters" aria-label="异常类型筛选">
            {exceptionFilters.map((item) => (
              <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div className="orderexceptionempty">
              <OrderIcon name="order" />
              <strong>此分类暂无异常订单</strong>
              <p>可切换其他异常类型继续处理。</p>
            </div>
          ) : null}
          <div className="orderexceptionlist" role="listbox" aria-label="异常订单队列">
            {visible.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.order.id === selected?.order.id}
                className={item.order.id === selected?.order.id ? 'isselected' : undefined}
                key={item.order.id}
                onClick={() => setSelectedId(item.order.id)}
              >
                <span>
                  <strong>{item.order.order_number}</strong>
                  <small>{formatOrderTime(item.order.updated_at)}</small>
                </span>
                <span>
                  <span className={`orderstatuspill tone-${item.primary.tone}`}>{item.primary.label}</span>
                  <small>{item.facts.length > 1 ? `另有 ${item.facts.length - 1} 项异常事实` : '单项异常事实'}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        {selected ? (
          <ExceptionDetail item={selected} onOpen={onOpen} />
        ) : (
          <div className="orderexceptionempty">
            <OrderIcon name="order" />
            <strong>没有可查看的异常事实</strong>
            <p>当前筛选范围内没有异常订单。</p>
          </div>
        )}
      </section>

      {recoveries.state === 'hidden' ? null : (
        <section className="orderexceptionrecovery" aria-labelledby="paymentrecoverytitle">
          <header>
            <div>
              <h3 id="paymentrecoverytitle">支付渠道恢复事项</h3>
              <p>直接来自支付恢复读模型，与订单异常事实分开呈现。</p>
            </div>
            {recoveries.state === 'ready' ? <strong>{recoveries.data.count} 项</strong> : null}
          </header>
          {recoveries.state === 'loading' ? <p role="status">正在读取支付恢复事项…</p> : null}
          {recoveries.state === 'locked' ? (
            <div className="orderexceptionprompt" role="status">
              <strong>完成二次验证后查看支付恢复事项</strong>
              <p>这里包含敏感交易信息，验证成功后会自动读取，不需要重新进入页面。</p>
              <button type="button" onClick={onUnlock}>
                完成二次验证
              </button>
            </div>
          ) : null}
          {recoveries.state === 'unavailable' ? (
            <div className="orderexceptionerror" role="alert">
              <strong>支付恢复数据暂时不可用</strong>
              <p>{recoveries.error.message}</p>
              {recoveries.error.traceId ? <small>请求追踪：{recoveries.error.traceId}</small> : null}
              {recoveries.error.retryable ? (
                <button type="button" onClick={onRetry}>
                  仅重试异常数据
                </button>
              ) : null}
            </div>
          ) : null}
          {recoveries.state === 'ready' && recoveries.data.items.length === 0 ? <p>当前范围没有支付恢复事项。</p> : null}
          {recoveries.state === 'ready' ? (
            <div className="orderexceptiongrid">
              {recoveries.data.items.map((recovery) => (
                <article key={recovery.id}>
                  <header>
                    <span className={`orderstatuspill tone-${recovery.severity === 'critical' ? 'danger' : 'warning'}`}>{recovery.severity === 'critical' ? '紧急恢复' : '高优先级'}</span>
                    <small>{formatOrderTime(recovery.openedAt)}</small>
                  </header>
                  <h3>{recovery.orderNumber ?? '未关联业务订单号'}</h3>
                  <p>
                    {recoveryLabel(recovery.errorCode)} · 已出现 {recovery.occurrenceCount} 次 · {chineseDomainLabel(recovery.state)}
                  </p>
                  {recovery.orderId ? (
                    <button type="button" onClick={() => onOpen(recovery.orderId!, 'payment')}>
                      进入支付分区处理
                    </button>
                  ) : (
                    <small>该事项未关联订单，请前往财务恢复中心处理。</small>
                  )}
                  <small>{chineseReference('恢复事项', recovery.id)}</small>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
