import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderDetail } from '../model/Order';
import { OrderDetailEmpty, OrderDetailInfo, OrderDetailSection, OrderSectionState } from './OrderDetailSection';
import { actionLabel, aftersaleLabel, formatOrderTime } from './OrderPresentation';

export function OrderActivityPanel({ order, mode, onRetry }: Readonly<{ order: OrderDetail; mode: 'aftersale' | 'operations'; onRetry: (() => void) | undefined }>) {
  return mode === 'aftersale' ? <AftersalePanel order={order} onRetry={onRetry} /> : <OperationsPanel order={order} onRetry={onRetry} />;
}

function AftersalePanel({ order, onRetry }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="售后汇总">
        <OrderSectionState section={order.sections.aftersale} title="售后汇总" onRetry={onRetry} />
        {order.sections.aftersale.state === 'ready' ? (
          <div className="orderdetailgrid">
            <OrderDetailInfo label="聚合售后状态" value={aftersaleLabel(order.aftersale_state)} />
            <OrderDetailInfo label="关联退款" value={`${order.refunds.length} 笔`} />
            <OrderDetailInfo label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
            <OrderDetailInfo label="订单版本" value={`第 ${order.version} 版`} />
          </div>
        ) : null}
      </OrderDetailSection>
      <OrderDetailSection title="退款与售后关联">
        {order.sections.aftersale.state !== 'ready' ? null : order.refunds.length === 0 ? (
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

function OperationsPanel({ order, onRetry }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="写操作审计时间线">
        <OrderSectionState section={order.sections.audit} title="操作记录" onRetry={onRetry} />
        {order.sections.audit.state !== 'ready' ? null : order.timeline.length === 0 ? (
          <OrderDetailEmpty text="本单暂无需要展示的写操作审计记录。" />
        ) : (
          <ol className="orderaudittimeline">
            {order.timeline.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabel(entry.action)}</strong>
                <span>
                  {formatOrderTime(entry.occurredAt)} · {entry.actorName}
                </span>
                <small>操作对象：{chineseDomainLabel(entry.resourceType, '订单')}</small>
              </li>
            ))}
          </ol>
        )}
      </OrderDetailSection>
    </div>
  );
}
