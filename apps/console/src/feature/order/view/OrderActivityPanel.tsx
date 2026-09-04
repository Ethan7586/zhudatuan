import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderRecord } from '../model/Order';
import { OrderDetailEmpty, OrderDetailInfo, OrderDetailSection } from './OrderDetailSection';
import { actionLabel, aftersaleLabel, formatOrderTime } from './OrderPresentation';

export function OrderActivityPanel({ order, mode }: Readonly<{ order: OrderRecord; mode: 'aftersale' | 'operations' }>) {
  return mode === 'aftersale' ? <AftersalePanel order={order} /> : <OperationsPanel order={order} />;
}

function AftersalePanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="售后汇总">
        <div className="orderdetailgrid">
          <OrderDetailInfo label="聚合售后状态" value={aftersaleLabel(order.aftersale_state)} />
          <OrderDetailInfo label="关联退款" value={`${order.refunds.length} 笔`} />
          <OrderDetailInfo label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <OrderDetailInfo label="订单版本" value={`第 ${order.version} 版`} />
        </div>
      </OrderDetailSection>
      <OrderDetailSection title="退款与售后关联">
        {order.refunds.length === 0 ? (
          <OrderDetailEmpty text="本单暂无售后退款记录。" />
        ) : (
          order.refunds.map((refund) => (
            <article className="orderreadcard" key={refund.id}>
              <strong>{refund.aftersaleId ? chineseReference('售后单', refund.aftersaleId) : '订单直接退款'}</strong>
              <small>
                {formatMinor(refund.amountMinor, refund.currency)} · {chineseDomainLabel(refund.state)} · {refund.reason}
              </small>
            </article>
          ))
        )}
      </OrderDetailSection>
    </div>
  );
}

function OperationsPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="写操作审计时间线">
        {order.timeline.length === 0 ? (
          <OrderDetailEmpty text="本单暂无需要展示的写操作审计记录。" />
        ) : (
          <ol className="orderaudittimeline">
            {order.timeline.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabel(entry.action)}</strong>
                <span>
                  {formatOrderTime(entry.occurredAt)} · {entry.actorMasked}
                </span>
                <small>
                  {entry.resourceMasked ?? chineseReference('订单', order.id)} · {entry.traceMasked}
                </small>
              </li>
            ))}
          </ol>
        )}
      </OrderDetailSection>
    </div>
  );
}
