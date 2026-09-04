import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderRecord } from '../model/Order';
import { OrderDetailEmpty, OrderDetailSection } from './OrderDetailSection';
import { OrderIcon } from './OrderIcon';
import { addressLabel, formatOrderTime, providerLabel } from './OrderPresentation';

export function OrderProductPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <OrderDetailSection title="商品快照">
        <div className="orderlinelist">
          {[...order.lines]
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((line) => (
              <article key={line.id}>
                <span className="orderproductthumb">
                  <OrderIcon name="package" />
                </span>
                <div>
                  <strong>{line.title}</strong>
                  <small>
                    {chineseReference('商品规格', line.sku)} · {chineseReference('上架记录', line.listing)}
                  </small>
                  <small>
                    数量 {line.quantity} · 单价 {formatMinor(line.unitMinor, order.currency)}
                  </small>
                  <small>履约来源 {providerLabel(line.provider ?? null, line.partner ?? null)}</small>
                </div>
                <b>{formatMinor(line.payableMinor, order.currency)}</b>
              </article>
            ))}
        </div>
      </OrderDetailSection>
      <OrderDetailSection title="履约单与物流节点">
        {order.fulfillments.length === 0 ? (
          <OrderDetailEmpty text="付款完成后将自动创建履约单。" />
        ) : (
          order.fulfillments.map((item) => (
            <article className="orderreadcard" key={item.id}>
              <strong>
                {chineseReference('履约单', item.id)} · {chineseDomainLabel(item.state)}
              </strong>
              <small>
                {providerLabel(item.provider, item.partner)} · {item.externalReferenceMasked ?? '内部履约'}
              </small>
              {item.milestones.length === 0 ? (
                <span>等待首个物流节点</span>
              ) : (
                item.milestones.map((milestone) => (
                  <span key={milestone.id}>
                    {formatOrderTime(milestone.occurredAt)} · {chineseDomainLabel(milestone.kind)} · {chineseDomainLabel(milestone.state)} {milestone.trackingMasked ?? ''}
                  </span>
                ))
              )}
            </article>
          ))
        )}
      </OrderDetailSection>
      <OrderDetailSection title="脱敏收货地址">
        <OrderDetailEmpty text={addressLabel(order)} />
      </OrderDetailSection>
    </div>
  );
}
