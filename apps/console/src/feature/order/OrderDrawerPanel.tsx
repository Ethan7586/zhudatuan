import type { ReactNode } from 'react';
import { formatMinor } from '../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, formatOrderTime, fulfillmentLabel, lifecycleLabel, paymentLabel } from './OrderPresentation';
import type { OrderDetailTab, OrderRecord } from './OrderSchema';

export function OrderDrawerPanel({
  order,
  tab,
}: Readonly<{
  order: OrderRecord;
  tab: OrderDetailTab;
}>) {
  if (tab === 'products') return <ProductsPanel order={order} />;
  if (tab === 'payment') return <PaymentPanel order={order} />;
  if (tab === 'aftersale') return <AftersalePanel order={order} />;
  if (tab === 'operations') return <OperationsPanel />;
  return <OverviewPanel order={order} />;
}

function OverviewPanel({ order }: Readonly<{ order: OrderRecord }>) {
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  return (
    <div className="orderdrawerstack">
      <section className="ordersummarynote">
        <p>订单为{lifecycleLabel(order.lifecycle_state)}状态；支付、履约与售后字段来自当前订单快照。</p>
        <small>状态链为聚合状态的展示映射；除下单外的里程碑时间尚未由当前读合同提供，最终动作保持关闭。</small>
      </section>
      <MilestoneChain order={order} />

      <DetailSection title="商品明细">
        <div className="orderlinepreview">
          {lines.length === 0 ? (
            <Unavailable text="当前订单快照未返回商品行" />
          ) : (
            lines.slice(0, 2).map((line) => (
              <div key={line.id}>
                <span className="orderproductthumb">
                  <OrderIcon name="package" />
                </span>
                <span>
                  <strong>{line.title}</strong>
                  <small>
                    {line.sku} ×{line.quantity}
                  </small>
                </span>
                <b>{formatMinor(line.payableMinor, order.currency)}</b>
              </div>
            ))
          )}
        </div>
      </DetailSection>

      <DetailSection title="金额与支付">
        <div className="orderdetailgrid">
          <Info label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <Info label="支付状态" value={paymentLabel(order.payment_state)} />
          <Info label="实付金额" value="当前读模型未提供" />
          <Info label="支付拆分" value="当前读模型未提供" />
        </div>
      </DetailSection>

      <DetailSection title="履约">
        <div className="orderdetailgrid">
          <Info label="履约状态" value={fulfillmentLabel(order.fulfillment_state)} />
          <Info label="履约 ID" value="当前读模型未提供" />
          <Info label="供应方" value={order.lines?.[0]?.provider ?? order.lines?.[0]?.partner ?? '当前读模型未提供'} />
          <Info label="收货信息" value="当前读模型未提供" />
        </div>
      </DetailSection>

      <p className="orderrecentoperation">最近 Operation： 当前读模型未提供审计时间线</p>
    </div>
  );
}

function MilestoneChain({ order }: Readonly<{ order: OrderRecord }>) {
  const paid = ['paid', 'partially_refunded', 'refunded'].includes(order.payment_state);
  const milestones = [
    { key: 'placed', label: '下单', state: 'complete', at: formatOrderTime(order.created_at) },
    { key: 'paid', label: '支付', state: paid ? 'complete' : 'current', at: undefined },
    { key: 'reserved', label: '库存锁定', state: 'pending', at: undefined },
    { key: 'unshipped', label: '待发货', state: order.fulfillment_state === 'allocated' ? 'current' : 'pending', at: undefined },
    { key: 'shipping', label: '待收货', state: order.fulfillment_state === 'shipped' ? 'current' : 'pending', at: undefined },
    { key: 'completed', label: '完成', state: order.lifecycle_state === 'completed' ? 'complete' : 'pending', at: undefined },
  ] as const;
  return (
    <ol className="ordermilestones" aria-label="订单状态链">
      {milestones.map((item) => (
        <li key={item.key} className={`is-${item.state}`}>
          <span>
            <OrderIcon name={item.state === 'complete' ? 'check' : item.key === 'unshipped' ? 'truck' : 'package'} />
          </span>
          <strong>{item.label}</strong>
          <small>{item.at === undefined ? (item.key === 'reserved' ? '不可用' : '—') : formatOrderTime(item.at)}</small>
        </li>
      ))}
    </ol>
  );
}

function ProductsPanel({ order }: Readonly<{ order: OrderRecord }>) {
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  return (
    <div className="orderdrawerstack">
      <DetailSection title="商品与履约快照">
        {lines.length === 0 ? (
          <Unavailable text="服务端未返回商品行" />
        ) : (
          <div className="orderlinelist">
            {lines.map((line) => (
              <article key={line.id}>
                <span className="orderproductthumb">
                  <OrderIcon name="package" />
                </span>
                <div>
                  <strong>{line.title}</strong>
                  <small>
                    SKU {line.sku} · Listing {line.listing}
                  </small>
                  <small>
                    数量 {line.quantity} · 单价 {formatMinor(line.unitMinor, order.currency)}
                  </small>
                  <small>履约来源 {line.provider ?? line.partner ?? '当前未提供'}</small>
                </div>
                <b>{formatMinor(line.payableMinor, order.currency)}</b>
              </article>
            ))}
          </div>
        )}
      </DetailSection>
      <Unavailable text="履约 ID、运单、里程碑时间与收货信息未包含在统一订单读模型中。" />
    </div>
  );
}

function PaymentPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="支付快照">
        <div className="orderdetailgrid">
          <Info label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <Info label="支付状态" value={paymentLabel(order.payment_state)} />
          <Info label="实付金额" value="当前读模型未提供" />
          <Info label="支付方式" value="当前读模型未提供" />
          <Info label="福利账户" value="当前读模型未提供" />
          <Info label="微信支付" value="当前读模型未提供" />
        </div>
      </DetailSection>
      <Unavailable text="支付 ID、可退余额与退款明细未由当前订单读合同提供；退款动作保持关闭。" />
    </div>
  );
}

function AftersalePanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="售后状态">
        <div className="orderdetailgrid">
          <Info label="聚合售后状态" value={aftersaleLabel(order.aftersale_state)} />
          <Info label="订单版本" value={String(order.version)} />
        </div>
      </DetailSection>
      <Unavailable text="当前合同不能按订单读取完整售后单、审批记录或责任人，不能用前端分页过滤替代。" />
    </div>
  );
}

function OperationsPanel() {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="最近 Operation">
        <Unavailable text="当前订单读模型没有 Operation 或审计时间线。" />
      </DetailSection>
      <Unavailable text="生产最终动作必须完成 Preview → Confirm → Step-up → Execute → Reread → Receipt 后才能写入这里。" />
    </div>
  );
}

function DetailSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="orderdetailsection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Info({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Unavailable({ text }: Readonly<{ text: string }>) {
  return (
    <p className="orderunavailable">
      <OrderIcon name="clock" />
      {text}
    </p>
  );
}
