import { formatMinor } from '../../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, aftersaleTone, formatOrderTime, fulfillmentLabel, fulfillmentTone, lifecycleLabel, paymentLabel, paymentTone, productSummary } from './OrderPresentation';
import type { OrderColumnKey } from '../model/OrderColumn';
import type { OrderRecord } from '../model/Order';

export function OrderTable({
  rows,
  visible,
  activeOrder,
  onOpen,
}: Readonly<{
  rows: readonly OrderRecord[];
  visible: ReadonlySet<OrderColumnKey>;
  activeOrder?: string;
  onOpen: (id: string) => void;
}>) {
  return (
    <div className="ordertablewrap">
      <table className="ordertable">
        <caption className="sr-only">订单列表</caption>
        <thead>
          <tr>
            <th scope="col">订单 / 时间</th>
            {visible.has('member') ? <th scope="col">会员 / 企业</th> : null}
            {visible.has('product') ? <th scope="col">商品摘要</th> : null}
            {visible.has('payment') ? <th className="orderamountcolumn" scope="col">金额 / 支付</th> : null}
            {visible.has('fulfillment') ? <th className="orderstatuscolumn" scope="col">履约状态</th> : null}
            {visible.has('aftersale') ? <th className="orderstatuscolumn" scope="col">售后</th> : null}
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <OrderRow key={order.id} order={order} visible={visible} active={activeOrder === order.id} onOpen={() => onOpen(order.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({
  order,
  visible,
  active,
  onOpen,
}: Readonly<{
  order: OrderRecord;
  visible: ReadonlySet<OrderColumnKey>;
  active: boolean;
  onOpen: () => void;
}>) {
  const product = productSummary(order);
  return (
    <tr
      className={active ? 'isactive' : undefined}
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <td data-label="订单 / 时间">
        <div className="orderprimarycell">
          <strong>{order.order_number}</strong>
          <span>{lifecycleLabel(order.lifecycle_state)} · {formatOrderTime(order.created_at)}</span>
        </div>
      </td>
      {visible.has('member') ? (
        <td data-label="会员 / 企业">
          <div className="orderprimarycell">
            <strong>{order.member_name}</strong>
            <span>{order.scope_name}</span>
          </div>
        </td>
      ) : null}
      {visible.has('product') ? (
        <td data-label="商品摘要">
          <div className="orderproductcell">
            <span className="orderproductthumb">
              <OrderIcon name="package" />
            </span>
            <span>
              <strong>{product.title}</strong>
              <small>{product.detail}</small>
            </span>
          </div>
        </td>
      ) : null}
      {visible.has('payment') ? (
        <td className="orderamountcolumn" data-label="金额 / 支付">
          <div className="orderprimarycell">
            <strong>{formatMinor(order.total_minor, order.currency)}</strong>
            <span className={`orderstatustext tone-${paymentTone(order.payment_state)}`}>
              <i />
              {paymentLabel(order.payment_state)}
            </span>
          </div>
        </td>
      ) : null}
      {visible.has('fulfillment') ? (
        <td className="orderstatuscolumn" data-label="履约状态">
          <StatusPill icon="truck" label={fulfillmentLabel(order.fulfillment_state)} tone={fulfillmentTone(order.fulfillment_state)} />
        </td>
      ) : null}
      {visible.has('aftersale') ? (
        <td className="orderstatuscolumn" data-label="售后">{order.aftersale_state === 'none' ? <span className="ordermutetext">无售后</span> : <StatusPill icon="clock" label={aftersaleLabel(order.aftersale_state)} tone={aftersaleTone(order.aftersale_state)} />}</td>
      ) : null}
      <td data-label="操作">
        <div className="orderrowactions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            aria-label={`查看订单 ${order.order_number}`}
          >
            查看
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: Readonly<{
  icon: 'clock' | 'truck';
  label: string;
  tone: 'brand' | 'success' | 'warning' | 'danger' | 'muted';
}>) {
  return (
    <span className={`orderstatuspill tone-${tone}`}>
      <OrderIcon name={icon} />
      {label}
    </span>
  );
}
