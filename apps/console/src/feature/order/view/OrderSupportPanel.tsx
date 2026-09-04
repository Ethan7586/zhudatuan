import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { OrderSupportState } from '../model/Order';
import { OrderDetailEmpty, OrderDetailSection } from './OrderDetailSection';
import { OrderIcon } from './OrderIcon';

export function OrderSupportPanel({ support, onRetry }: Readonly<{ support: OrderSupportState; onRetry: () => void }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="关联客服工单">
        {support.state === 'loading' ? <p className="ordersectionstate" role="status"><OrderIcon name="clock" /><span><strong>正在读取客服工单</strong><small>订单其他分区可继续使用。</small></span></p> : null}
        {support.state === 'hidden' ? <p className="ordersectionstate" role="status"><OrderIcon name="lock" /><span><strong>客服工单已按当前权限隐藏</strong><small>获得客服工单读取权限后可查看；订单其他事实不受影响。</small></span></p> : null}
        {support.state === 'unavailable' ? <section className="ordersectionstate iserror" role="alert"><OrderIcon name="warning" /><span><strong>客服工单暂时不可用</strong><small>{support.error.message}</small>{support.error.traceId ? <small>请求追踪号：{support.error.traceId}</small> : null}{support.error.retryable ? <button type="button" onClick={onRetry}>仅重试客服分区</button> : null}</span></section> : null}
        {support.state === 'ready' && support.data.length === 0 ? <OrderDetailEmpty text="本单暂无关联客服工单。" /> : null}
        {support.state === 'ready' ? support.data.map((ticket) => (
          <article className="orderreadcard" key={ticket.id}>
            <strong>{ticket.subject}</strong>
            <small>{chineseDomainLabel(ticket.state)} · {chineseDomainLabel(ticket.priority)} · {chineseDomainLabel(ticket.slaRisk)}</small>
            <span>{chineseReference('客服工单', ticket.id)} · 更新于 {formatDate(ticket.updatedAt)}{ticket.unreadCount > 0 ? ` · ${ticket.unreadCount} 条未读` : ''}</span>
          </article>
        )) : null}
      </OrderDetailSection>
    </div>
  );
}
