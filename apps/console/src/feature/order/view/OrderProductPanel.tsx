import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderDetail } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderDetailEmpty, OrderDetailSection, OrderSectionState } from './OrderDetailSection';
import { OrderIcon } from './OrderIcon';
import { addressLabel, formatOrderTime, providerLabel } from './OrderPresentation';

export function OrderProductPanel({ order, onRetry, viewmodel }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined; viewmodel?: DetailViewModel }>) {
  return (
    <div className="orderdrawerstack">
      <OrderProductSnapshot order={order} onRetry={onRetry} />
      <OrderFulfillmentSnapshot order={order} onRetry={onRetry} {...(viewmodel ? { canShip: viewmodel.canShip, onShip: viewmodel.actions.openShip } : {})} />
      <OrderAddressSnapshot order={order} />
    </div>
  );
}

export function OrderProductSnapshot({ order, onRetry }: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined }>) {
  return (
    <OrderDetailSection title="商品快照">
      <OrderSectionState section={order.sections.products} title="商品快照" onRetry={onRetry} />
      {order.sections.products.state === 'ready' ? (
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
                  <small>下单商品快照</small>
                  <small>
                    数量 {line.quantity} · 单价 {formatMinor(line.unitMinor, order.currency)}
                  </small>
                  <small>履约来源 {providerLabel(line.provider ?? null, line.partnerName ?? null)}</small>
                </div>
                <b>{formatMinor(line.payableMinor, order.currency)}</b>
              </article>
            ))}
        </div>
      ) : null}
    </OrderDetailSection>
  );
}

export function OrderFulfillmentSnapshot({
  order,
  onRetry,
  canShip,
  onShip,
}: Readonly<{ order: OrderDetail; onRetry: (() => void) | undefined; canShip?: (target: OrderDetail['fulfillments'][number]) => boolean; onShip?: (target: OrderDetail['fulfillments'][number]) => void }>) {
  return (
    <OrderDetailSection title="履约单与物流节点">
      <OrderSectionState section={order.sections.fulfillment} title="履约与物流" onRetry={onRetry} />
      {order.sections.fulfillment.state !== 'ready' ? null : order.fulfillments.length === 0 ? (
        <OrderDetailEmpty text="付款完成后将自动创建履约单。" />
      ) : (
        order.fulfillments.map((item) => (
          <article className="orderreadcard" key={item.id}>
            <strong>
              {chineseReference('履约单', item.id)} · {chineseDomainLabel(item.state)}
            </strong>
            <small>
              {providerLabel(item.provider, item.partnerName)} · {item.externalReferenceMasked ?? '内部履约'}
            </small>
            {item.state === 'needsaction' ? <span role="alert">自动处理已暂停，请在异常订单中核对渠道结果后由运营人员接管。</span> : null}
            {item.milestones.length === 0 ? (
              <span>等待首个物流节点</span>
            ) : (
              item.milestones.map((milestone) => (
                <span key={milestone.id}>
                  {formatOrderTime(milestone.occurredAt)} · {chineseDomainLabel(milestone.kind)} · {chineseDomainLabel(milestone.state)} {milestone.trackingMasked ?? ''}
                </span>
              ))
            )}
            {canShip?.(item) && onShip ? (
              <button type="button" onClick={() => onShip(item)}>
                登记发货
              </button>
            ) : null}
          </article>
        ))
      )}
    </OrderDetailSection>
  );
}

export function OrderAddressSnapshot({ order }: Readonly<{ order: OrderDetail }>) {
  return (
    <OrderDetailSection title="脱敏收货地址">
      <OrderDetailEmpty text={addressLabel(order)} />
    </OrderDetailSection>
  );
}
