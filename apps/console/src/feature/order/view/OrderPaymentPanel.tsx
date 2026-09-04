import { chineseDomainLabel } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderRecord } from '../model/Order';
import { OrderDetailEmpty, OrderDetailInfo, OrderDetailSection } from './OrderDetailSection';
import { tenderLabel } from './OrderPresentation';

export function OrderPaymentPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="支付汇总">
        <div className="orderdetailgrid">
          <OrderDetailInfo label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <OrderDetailInfo label="实付金额" value={formatMinor(order.payment.capturedMinor, order.currency)} />
          <OrderDetailInfo label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <OrderDetailInfo label="可退余额" value={formatMinor(order.payment.refundableMinor, order.currency)} />
        </div>
      </OrderDetailSection>
      <OrderDetailSection title="支付拆分">
        {order.payment.tenders.length === 0 ? (
          <OrderDetailEmpty text={order.payment.paymentId ? '本单没有资金拆分记录。' : '订单尚未支付。'} />
        ) : (
          order.payment.tenders.map((tender) => (
            <article className="orderreadcard" key={`${tender.sequence}:${tender.kind}`}>
              <strong>
                {tenderLabel(tender.kind)} · {formatMinor(tender.amountMinor, order.currency)}
              </strong>
              <small>
                {chineseDomainLabel(tender.state)}
                {tender.referenceMasked ? ` · ${tender.referenceMasked}` : ''}
              </small>
            </article>
          ))
        )}
      </OrderDetailSection>
      <OrderDetailSection title="退款明细">
        {order.refunds.length === 0 ? (
          <OrderDetailEmpty text="本单暂无退款。" />
        ) : (
          order.refunds.map((refund) => (
            <article className="orderreadcard" key={refund.id}>
              <strong>
                {formatMinor(refund.amountMinor, refund.currency)} · {chineseDomainLabel(refund.state)}
              </strong>
              <small>
                {refund.reason} · {refund.provider} · {refund.providerReferenceMasked}
              </small>
              {refund.tenders.map((tender) => (
                <span key={`${refund.id}:${tender.sequence}`}>
                  {tenderLabel(tender.kind)} {formatMinor(tender.amountMinor, refund.currency)} · {chineseDomainLabel(tender.state)}
                </span>
              ))}
            </article>
          ))
        )}
      </OrderDetailSection>
    </div>
  );
}
