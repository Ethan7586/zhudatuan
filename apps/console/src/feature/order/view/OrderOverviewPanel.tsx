import { chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import type { OrderRecord } from '../model/Order';
import { OrderDetailInfo, OrderDetailSection } from './OrderDetailSection';
import { OrderIcon } from './OrderIcon';
import { actionLabel, addressLabel, formatOrderTime, fulfillmentLabel, lifecycleLabel, providerLabel } from './OrderPresentation';

export function OrderOverviewPanel({ order }: Readonly<{ order: OrderRecord }>) {
  const lines = [...order.lines].sort((left, right) => left.id.localeCompare(right.id));
  const fulfillment = order.fulfillments[0];
  return (
    <div className="orderdrawerstack">
      <section className="ordersummarynote">
        <p>订单处于{lifecycleLabel(order.lifecycle_state)}状态；金额、支付、履约、退款与审计均来自服务端权威读模型。</p>
        <small>收件人与联系方式只显示下单时固化的脱敏快照，复制与日志均不会暴露明文。</small>
      </section>
      <MilestoneChain order={order} />
      <OrderDetailSection title="商品明细">
        <div className="orderlinepreview">
          {lines.slice(0, 2).map((line) => (
            <div key={line.id}>
              <span className="orderproductthumb">
                <OrderIcon name="package" />
              </span>
              <span>
                <strong>{line.title}</strong>
                <small>
                  {chineseReference('商品规格', line.sku)} ×{line.quantity}
                </small>
              </span>
              <b>{formatMinor(line.payableMinor, order.currency)}</b>
            </div>
          ))}
        </div>
      </OrderDetailSection>
      <OrderDetailSection title="金额与支付">
        <div className="orderdetailgrid">
          <OrderDetailInfo label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <OrderDetailInfo label="实付金额" value={formatMinor(order.payment.capturedMinor, order.currency)} />
          <OrderDetailInfo label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <OrderDetailInfo label="可退余额" value={formatMinor(order.payment.refundableMinor, order.currency)} />
        </div>
      </OrderDetailSection>
      <OrderDetailSection title="履约与收货">
        <div className="orderdetailgrid">
          <OrderDetailInfo label="履约状态" value={fulfillmentLabel(order.fulfillment_state)} />
          <OrderDetailInfo label="履约单" value={fulfillment ? chineseReference('履约单', fulfillment.id) : '尚未创建'} />
          <OrderDetailInfo label="供应方" value={providerLabel(fulfillment?.provider ?? order.lines[0]?.provider ?? null, fulfillment?.partner ?? order.lines[0]?.partner ?? null)} />
          <OrderDetailInfo label="收货信息" value={addressLabel(order)} />
        </div>
      </OrderDetailSection>
      <p className="orderrecentoperation">最近操作：{order.timeline[0] ? `${actionLabel(order.timeline[0].action)} · ${formatOrderTime(order.timeline[0].occurredAt)}` : '暂无写操作审计记录'}</p>
    </div>
  );
}

function MilestoneChain({ order }: Readonly<{ order: OrderRecord }>) {
  const milestones = order.fulfillments.flatMap((item) => item.milestones);
  const shipped = milestones.find((item) => ['shipped', 'intransit', 'outfordelivery'].includes(item.state.toLowerCase()));
  const completed = milestones.find((item) => ['delivered', 'completed', 'pickedup'].includes(item.state.toLowerCase()));
  const items = [
    { key: 'placed', label: '下单', complete: true, current: false, at: order.created_at },
    { key: 'paid', label: '支付', complete: order.payment.paymentId !== null, current: order.payment.paymentId === null, at: order.payment.updatedAt },
    { key: 'allocated', label: '创建履约', complete: order.fulfillments.length > 0, current: order.payment.paymentId !== null && order.fulfillments.length === 0, at: order.fulfillments[0]?.createdAt ?? null },
    { key: 'shipping', label: '运输中', complete: shipped !== undefined || completed !== undefined, current: order.fulfillments.some((item) => ['accepted', 'processing', 'ready'].includes(item.state)), at: shipped?.occurredAt ?? null },
    { key: 'completed', label: '送达', complete: completed !== undefined, current: false, at: completed?.occurredAt ?? null },
    { key: 'received', label: '确认收货', complete: order.receivedAt !== null, current: completed !== undefined && order.receivedAt === null, at: order.receivedAt },
  ];
  return (
    <ol className="ordermilestones" aria-label="订单状态链">
      {items.map((item) => {
        const state = item.complete ? 'complete' : item.current ? 'current' : 'pending';
        return (
          <li key={item.key} className={`is-${state}`}>
            <span>
              <OrderIcon name={item.complete ? 'check' : item.key === 'shipping' ? 'truck' : 'package'} />
            </span>
            <strong>{item.label}</strong>
            <small>{item.at ? formatOrderTime(item.at) : '待发生'}</small>
          </li>
        );
      })}
    </ol>
  );
}
