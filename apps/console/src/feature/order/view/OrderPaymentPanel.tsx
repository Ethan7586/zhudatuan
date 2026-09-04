import { chineseDomainLabel } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderDetail } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderDetailEmpty, OrderDetailInfo, OrderDetailSection, OrderSectionState } from './OrderDetailSection';
import { tenderLabel } from './OrderPresentation';
import { OrderRecoveryPanel } from './OrderRecoveryPanel';

export function OrderPaymentPanel({ order, onRetry, viewmodel }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined; viewmodel?: DetailViewModel }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="支付汇总">
        <OrderSectionState section={order.sections.payment} title="支付汇总" onRetry={onRetry} />
        {order.sections.payment.state === 'ready' ? (
        <div className="orderdetailgrid">
          <OrderDetailInfo label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <OrderDetailInfo label="实付金额" value={formatMinor(order.payment.capturedMinor, order.currency)} />
          <OrderDetailInfo label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <OrderDetailInfo label="可退余额" value={formatMinor(order.payment.refundableMinor, order.currency)} />
        </div>
        ) : null}
      </OrderDetailSection>
      <OrderDetailSection title="支付拆分">
        {order.sections.payment.state !== 'ready' ? null : order.payment.tenders.length === 0 ? (
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
        <OrderSectionState section={order.sections.aftersale} title="退款明细" onRetry={onRetry} />
        {order.sections.aftersale.state !== 'ready' ? null : order.refunds.length === 0 ? (
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
      {viewmodel?.canRefund ? <button className="orderprimaryaction" type="button" onClick={viewmodel.actions.openRefund}>提交退款</button> : null}
      {viewmodel ? <OrderRecoveryPanel state={viewmodel.recoveries} canResolve={viewmodel.canResolveRecovery} onResolve={viewmodel.actions.openRecovery} onRetry={viewmodel.refreshRecoveries} /> : null}
    </div>
  );
}
