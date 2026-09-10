import type { ReactNode } from 'react';
import { formatMinor } from '../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, financeLabel, formatOrderTime, fulfillmentLabel, inventoryLabel, lifecycleLabel, paymentLabel, previewRecord } from './OrderPresentation';
import type { OrderDetailTab, OrderRecord } from './OrderSchema';

export function OrderDrawerPanel({
  order,
  tab,
  previewEnabled,
}: Readonly<{
  order: OrderRecord;
  tab: OrderDetailTab;
  previewEnabled: boolean;
}>) {
  if (tab === 'products') return <ProductsPanel order={order} />;
  if (tab === 'payment') return <PaymentPanel order={order} previewEnabled={previewEnabled} />;
  if (tab === 'aftersale') return <AftersalePanel order={order} />;
  if (tab === 'operations') return <OperationsPanel order={order} previewEnabled={previewEnabled} />;
  return <OverviewPanel order={order} previewEnabled={previewEnabled} />;
}

function OverviewPanel({ order, previewEnabled }: Readonly<{ order: OrderRecord; previewEnabled: boolean }>) {
  const preview = previewRecord(order, previewEnabled);
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  return (
    <div className="orderdrawerstack">
      <section className="ordersummarynote">
        <p>{preview?.summary ?? `订单为${lifecycleLabel(order.lifecycle_state)}状态；订单、财务、商品为明线，现金结果用于核验财务。`}</p>
        {!previewEnabled ? <small>所有状态来自当前授权节点的权威订单读模型；没有事实来源的结算、路径和里程碑不会推测。</small> : <small>本地预览数据 · 不作为生产业务真值</small>}
      </section>
      <FourFlowSummary order={order} />
      <MilestoneChain order={order} previewEnabled={previewEnabled} />

      <DetailSection title="消费者信息">
        <div className="orderdetailgrid">
          <Info label="消费者" value={preview?.memberName ?? '当前读模型未提供'} />
          <Info label="联系方式" value="当前读模型未提供" />
        </div>
      </DetailSection>

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
                    规格 {line.sku} · 数量 {line.quantity}
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
          <Info label="实付金额" value={preview === undefined ? '当前读模型未提供' : formatMinor(preview.paidMinor, order.currency)} />
          <Info label="支付拆分" value={preview === undefined ? '当前读模型未提供' : `${preview.paymentMethod} · 已对齐`} />
        </div>
      </DetailSection>

      <DetailSection title="履约">
        <div className="orderdetailgrid">
          <Info label="履约状态" value={fulfillmentLabel(order.fulfillment_state)} />
          <Info label="供应方" value={preview?.supplierName ?? '未关联'} />
          <Info label="收货信息" value={preview?.addressSummary ?? '暂无'} />
        </div>
      </DetailSection>

      <p className="orderrecentoperation">
        最近 Operation：
        {preview?.operation === undefined ? (
          '当前读模型未提供审计时间线'
        ) : (
          <>
            <strong>{preview.operation.label}</strong> · {formatOrderTime(preview.operation.at)}
          </>
        )}
      </p>
    </div>
  );
}

function MilestoneChain({ order, previewEnabled }: Readonly<{ order: OrderRecord; previewEnabled: boolean }>) {
  const preview = previewRecord(order, previewEnabled);
  const milestones = preview?.milestones ?? [];
  if (milestones.length === 0) return <Unavailable text="当前读模型未返回真实状态事件时间线。" />;
  return (
    <ol className="ordermilestones" aria-label="订单状态链">
      {milestones.map((item) => (
        <li key={item.key} className={`is-${item.state}`}>
          <span>
            <OrderIcon name={item.state === 'complete' ? 'check' : item.key === 'unshipped' ? 'truck' : 'package'} />
          </span>
          <strong>{item.label}</strong>
          <small>{item.at === undefined ? (preview === undefined && item.key === 'reserved' ? '不可用' : '—') : formatOrderTime(item.at)}</small>
        </li>
      ))}
    </ol>
  );
}

function ProductsPanel({ order }: Readonly<{ order: OrderRecord }>) {
  const lines = [...(order.lines ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const reservations = [...(order.inventory_reservations ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  const aftersales = [...(order.aftersales ?? [])].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
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
                  <small>规格 {line.sku}</small>
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
      <DetailSection title="库存事实">
        {reservations.length === 0 ? (
          <Unavailable text="当前授权范围没有返回库存占用记录。" />
        ) : (
          <div className="orderdetailgrid">
            {reservations.map((reservation, index) => (
              <Info key={reservation.id} label={`库存占用 ${index + 1}`} value={`${reservation.state} · ${reservation.quantity} 件`} />
            ))}
          </div>
        )}
      </DetailSection>
      <DetailSection title="退换货事实">
        {aftersales.length === 0 ? (
          <Unavailable text="当前订单没有退货、换货或退款申请。" />
        ) : (
          <div className="orderdetailgrid">
            {aftersales.map((aftersale) => (
              <Info key={aftersale.id} label={`${aftersaleKindLabel(aftersale.kind)} · ${aftersale.state}`} value={`${aftersale.quantity ?? '整单'} · ${aftersale.reason}`} />
            ))}
          </div>
        )}
      </DetailSection>
      <Unavailable text="运单与完整履约里程碑尚未进入统一订单读模型。" />
    </div>
  );
}

function PaymentPanel({ order, previewEnabled }: Readonly<{ order: OrderRecord; previewEnabled: boolean }>) {
  const preview = previewRecord(order, previewEnabled);
  return (
    <div className="orderdrawerstack">
      <DetailSection title="支付快照">
        <div className="orderdetailgrid">
          <Info label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <Info label="财务状态" value={financeLabel(order)} />
          <Info label="现金结果" value={paymentLabel(order.payment_state)} />
          <Info label="实付金额" value={preview === undefined ? '当前读模型未提供' : formatMinor(preview.paidMinor, order.currency)} />
          <Info label="支付方式" value={preview?.paymentMethod ?? '当前读模型未提供'} />
          <Info label="福利账户" value={preview === undefined ? '当前读模型未提供' : formatMinor(preview.benefitMinor, order.currency)} />
          <Info label="微信支付" value={preview === undefined ? '当前读模型未提供' : formatMinor(preview.wechatMinor, order.currency)} />
        </div>
      </DetailSection>
      <Unavailable text="支付 ID、可退余额与退款明细未由当前订单读合同提供；退款动作保持关闭。" />
    </div>
  );
}

function FourFlowSummary({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <DetailSection title="四流合一">
      <div className="orderdetailgrid">
        <Info label="订单流" value={lifecycleLabel(order.lifecycle_state)} />
        <Info label="财务流" value={`${formatMinor(order.total_minor, order.currency)} · ${financeLabel(order)}`} />
        <Info label="商品流" value={`${fulfillmentLabel(order.fulfillment_state)} · ${inventoryLabel(order)} · ${aftersaleLabel(order.aftersale_state)}`} />
        <Info label="现金暗线" value={paymentLabel(order.payment_state)} />
      </div>
    </DetailSection>
  );
}

function aftersaleKindLabel(kind: 'cancel' | 'return' | 'refund' | 'exchange' | 'claim'): string {
  return ({ cancel: '取消', return: '退货', refund: '退款', exchange: '换货', claim: '理赔' } as const)[kind];
}

function AftersalePanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="售后状态">
        <div className="orderdetailgrid">
          <Info label="聚合售后状态" value={aftersaleLabel(order.aftersale_state)} />
        </div>
      </DetailSection>
      <Unavailable text="当前合同不能按订单读取完整售后单、审批记录或责任人，不能用前端分页过滤替代。" />
    </div>
  );
}

function OperationsPanel({ order, previewEnabled }: Readonly<{ order: OrderRecord; previewEnabled: boolean }>) {
  const operation = previewRecord(order, previewEnabled)?.operation;
  const icon = operation?.status === 'failed' ? 'close' : operation?.status === 'pending' ? 'clock' : 'check';
  return (
    <div className="orderdrawerstack">
      <DetailSection title="最近 Operation">
        {operation === undefined ? (
          <Unavailable text="当前订单读模型没有 Operation 或审计时间线。" />
        ) : (
          <article className={`orderoperation is-${operation.status}`}>
            <OrderIcon name={icon} />
            <div>
              <span>{operation.label}</span>
              <small>{formatOrderTime(operation.at)}</small>
            </div>
          </article>
        )}
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
