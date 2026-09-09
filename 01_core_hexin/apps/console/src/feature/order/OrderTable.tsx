import { Button } from 'react-aria-components';
import { formatMinor } from '../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { OrderPreviewAction } from './OrderPreviewAction';
import { aftersaleLabel, aftersaleTone, financeLabel, formatOrderTime, fulfillmentLabel, fulfillmentTone, inventoryLabel, lifecycleLabel, paymentLabel, paymentTone, previewRecord, productSummary } from './OrderPresentation';
import type { OrderRecord } from './OrderSchema';

export type OrderColumnKey = 'member' | 'finance' | 'product' | 'payment' | 'fulfillment' | 'aftersale' | 'sla';

export const defaultOrderColumns: ReadonlySet<OrderColumnKey> = new Set(['member', 'finance', 'product', 'payment', 'fulfillment', 'aftersale']);

export function OrderTable({
  rows,
  previewEnabled,
  visible,
  checked,
  activeOrder,
  onCheck,
  onCheckAll,
  onOpen,
}: Readonly<{
  rows: readonly OrderRecord[];
  previewEnabled: boolean;
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
            <th scope="col">订单流 / 时间</th>
            {visible.has('member') ? <th scope="col">会员 / 节点</th> : null}
            {visible.has('finance') ? <th scope="col">财务流</th> : null}
            {visible.has('product') ? <th scope="col">商品流</th> : null}
            {visible.has('payment') ? <th scope="col">现金暗线</th> : null}
            {visible.has('fulfillment') ? <th scope="col">商品履约</th> : null}
            {visible.has('aftersale') ? <th scope="col">售后</th> : null}
            {visible.has('sla') ? <th scope="col">SLA</th> : null}
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <OrderRow key={order.id} order={order} previewEnabled={previewEnabled} visible={visible} checked={checked.has(order.id)} active={activeOrder === order.id} onCheck={() => onCheck(order.id)} onOpen={() => onOpen(order.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({
  order,
  previewEnabled,
  visible,
  checked,
  active,
  onCheck,
  onOpen,
}: Readonly<{
  order: OrderRecord;
  previewEnabled: boolean;
  visible: ReadonlySet<OrderColumnKey>;
  checked: boolean;
  active: boolean;
  onCheck: () => void;
  onOpen: () => void;
}>) {
  const preview = previewRecord(order, previewEnabled);
  const product = productSummary(order);
  const paidMinor = preview?.paidMinor ?? order.total_minor;
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
          <span>{lifecycleLabel(order.lifecycle_state)} · {formatOrderTime(order.created_at)}</span>
        </div>
      </td>
      {visible.has('member') ? (
        <td>
          <div className="orderprimarycell">
            <strong>{preview?.memberName ?? order.member_id ?? '会员显示名不可用'}</strong>
            <span>{preview?.enterpriseName ?? order.mall_id ?? order.scope_id ?? '节点归属未返回'}</span>
          </div>
        </td>
      ) : null}
      {visible.has('finance') ? (
        <td>
          <div className="orderprimarycell">
            <strong>{formatMinor(order.total_minor, order.currency)}</strong>
            <span>{financeLabel(order)}</span>
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
              <small>{product.detail} · {inventoryLabel(order)}</small>
            </span>
          </div>
        </td>
      ) : null}
      {visible.has('payment') ? (
        <td>
          <div className="orderprimarycell">
            <span className={`orderstatustext tone-${paymentTone(order.payment_state)}`}>
              <i />
              {preview?.paymentMethod ?? paymentLabel(order.payment_state)}
            </span>
            <small>{preview === undefined ? '现金结果' : formatMinor(paidMinor, order.currency)}</small>
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
          {preview?.slaMinutes === undefined ? (
            <span className="ordermutetext" title="当前读模型未返回 SLA">
              未提供
            </span>
          ) : (
            <span className={`ordersla ${preview.slaMinutes <= 20 ? 'tone-warning' : 'tone-danger'}`}>
              <OrderIcon name="clock" />
              剩余 {preview.slaMinutes} 分钟
            </span>
          )}
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
          <OrderPreviewAction
            ariaLabel={`订单 ${order.order_number} 更多操作`}
            title={`订单操作预览 ${order.order_number}`}
            disabled={!previewEnabled}
            describedBy="orderwriteboundary"
            triggerClassName="ordermorebutton"
            triggerTitle={previewEnabled ? '打开订单操作预览' : '最终动作等待 Preview 与 action-bound proof'}
            trigger={<OrderIcon name="more" />}
          >
            {(close) => (
              <div className="orderpreviewoptions">
                <Button
                  type="button"
                  onPress={() => {
                    close();
                    onOpen();
                  }}
                >
                  查看订单详情
                </Button>
              </div>
            )}
          </OrderPreviewAction>
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
