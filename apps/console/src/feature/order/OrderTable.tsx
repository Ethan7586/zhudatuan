import { formatMinor } from '../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, aftersaleTone, formatOrderTime, fulfillmentLabel, fulfillmentTone, paymentLabel, paymentTone, productSummary } from './OrderPresentation';
import type { OrderRecord } from './OrderSchema';

export type OrderColumnKey = 'member' | 'product' | 'payment' | 'fulfillment' | 'aftersale' | 'sla';

export const defaultOrderColumns: ReadonlySet<OrderColumnKey> = new Set(['member', 'product', 'payment', 'fulfillment', 'aftersale', 'sla']);

export function OrderTable({
  rows,
  visible,
  checked,
  activeOrder,
  onCheck,
  onCheckAll,
  onOpen,
}: Readonly<{
  rows: readonly OrderRecord[];
  visible: ReadonlySet<OrderColumnKey>;
  checked: ReadonlySet<string>;
  activeOrder?: string;
  onCheck: (id: string) => void;
  onCheckAll: () => void;
  onOpen: (id: string) => void;
}>) {
  const allChecked = rows.length > 0 && rows.every((row) => checked.has(row.id));
  return (
    <div className="ordertablewrap">
      <table className="ordertable">
        <caption className="sr-only">订单列表</caption>
        <thead>
          <tr>
            <th className="ordercheckcell" scope="col">
              <input type="checkbox" aria-label="选择本页订单" checked={allChecked} onChange={onCheckAll} />
            </th>
            <th scope="col">订单 / 时间</th>
            {visible.has('member') ? <th scope="col">会员 / 企业</th> : null}
            {visible.has('product') ? <th scope="col">商品摘要</th> : null}
            {visible.has('payment') ? <th scope="col">金额 / 支付</th> : null}
            {visible.has('fulfillment') ? <th scope="col">履约状态</th> : null}
            {visible.has('aftersale') ? <th scope="col">售后</th> : null}
            {visible.has('sla') ? <th scope="col">SLA</th> : null}
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <OrderRow key={order.id} order={order} visible={visible} checked={checked.has(order.id)} active={activeOrder === order.id} onCheck={() => onCheck(order.id)} onOpen={() => onOpen(order.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({
  order,
  visible,
  checked,
  active,
  onCheck,
  onOpen,
}: Readonly<{
  order: OrderRecord;
  visible: ReadonlySet<OrderColumnKey>;
  checked: boolean;
  active: boolean;
  onCheck: () => void;
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
      <td className="ordercheckcell">
        <input type="checkbox" aria-label={`选择订单 ${order.order_number}`} checked={checked} onClick={(event) => event.stopPropagation()} onChange={onCheck} />
      </td>
      <td>
        <div className="orderprimarycell">
          <strong>{order.order_number}</strong>
          <span>{formatOrderTime(order.created_at)}</span>
        </div>
      </td>
      {visible.has('member') ? (
        <td>
          <div className="orderprimarycell">
            <strong>{order.member_id ?? '会员 ID 不可用'}</strong>
            <span>{order.scope_id ?? '组织范围不可用'}</span>
          </div>
        </td>
      ) : null}
      {visible.has('product') ? (
        <td>
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
        <td>
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
        <td>
          <StatusPill icon="truck" label={fulfillmentLabel(order.fulfillment_state)} tone={fulfillmentTone(order.fulfillment_state)} />
        </td>
      ) : null}
      {visible.has('aftersale') ? (
        <td>{order.aftersale_state === 'none' ? <span className="ordermutetext">无售后</span> : <StatusPill icon="clock" label={aftersaleLabel(order.aftersale_state)} tone={aftersaleTone(order.aftersale_state)} />}</td>
      ) : null}
      {visible.has('sla') ? (
        <td>
          <span className="ordermutetext" title="当前读模型未返回 SLA">
            未提供
          </span>
        </td>
      ) : null}
      <td>
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
          <button className="ordermorebutton" type="button" disabled aria-label={`订单 ${order.order_number} 更多操作`} title="最终动作等待服务端合同" aria-describedby="orderwriteboundary">
            <OrderIcon name="more" />
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
