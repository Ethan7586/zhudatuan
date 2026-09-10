import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { OrderDetailTab } from '../model/Order';
import { aftersaleLabel, formatOrderTime, fulfillmentLabel, lifecycleLabel, paymentLabel } from './OrderPresentation';
import { hasKind, tabLabel, type ExceptionItem } from './OrderExceptionModel';

export function ExceptionDetail({ item, onOpen }: Readonly<{ item: ExceptionItem; onOpen: (id: string, tab: OrderDetailTab) => void }>) {
  const order = item.order;
  const latestMilestone = [...order.fulfillments].flatMap((fulfillment) => fulfillment.milestones).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  return (
    <article className="orderexceptiondetail">
      <header>
        <div>
          <span className="ordersectioneyebrow">当前选中订单</span>
          <h3>{order.order_number}</h3>
        </div>
        <small>更新于 {formatOrderTime(order.updated_at)}</small>
      </header>
      <section>
        <h4>异常事实</h4>
        <div className="orderexceptionfacts">
          {item.facts.map((fact) => (
            <article key={fact.kind}>
              <span className={`orderstatuspill tone-${fact.tone}`}>{fact.label}</span>
              <p>{fact.description}</p>
              <button type="button" onClick={() => onOpen(order.id, fact.tab)}>
                进入{tabLabel(fact.tab)}分区
              </button>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h4>权威状态</h4>
        <dl className="orderexceptionstates">
          <div>
            <dt>支付</dt>
            <dd>{paymentLabel(order.payment_state)}</dd>
          </div>
          <div>
            <dt>履约</dt>
            <dd>{fulfillmentLabel(order.fulfillment_state)}</dd>
          </div>
          <div>
            <dt>售后</dt>
            <dd>{aftersaleLabel(order.aftersale_state)}</dd>
          </div>
          <div>
            <dt>订单</dt>
            <dd>{lifecycleLabel(order.lifecycle_state)}</dd>
          </div>
          <div>
            <dt>来源异常</dt>
            <dd>{hasKind(item, 'source') ? '服务端异常条件已识别' : '请在订单概览核对'}</dd>
          </div>
          <div>
            <dt>最近履约节点</dt>
            <dd>{latestMilestone ? `${chineseDomainLabel(latestMilestone.kind, '履约节点')} · ${formatOrderTime(latestMilestone.occurredAt)}` : '尚无履约节点'}</dd>
          </div>
        </dl>
      </section>
      <footer>
        <span>订单版本：第 {order.version} 版</span>
        <span>{chineseReference('内部订单', order.id)}</span>
      </footer>
    </article>
  );
}
