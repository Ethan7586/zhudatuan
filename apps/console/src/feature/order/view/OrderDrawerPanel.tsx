import type { ReactNode } from 'react';
import { chineseDomainLabel, chineseProviderLabel, chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/ui/Format';
import { OrderIcon } from './OrderIcon';
import { aftersaleLabel, formatOrderTime, fulfillmentLabel, lifecycleLabel, paymentLabel } from './OrderPresentation';
import type { OrderDetailTab, OrderRecord } from '../model/Order';

export function OrderDrawerPanel({ order, tab }: Readonly<{ order: OrderRecord; tab: OrderDetailTab }>) {
  if (tab === 'products') return <ProductsPanel order={order} />;
  if (tab === 'payment') return <PaymentPanel order={order} />;
  if (tab === 'aftersale') return <AftersalePanel order={order} />;
  if (tab === 'operations') return <OperationsPanel order={order} />;
  return <OverviewPanel order={order} />;
}

function OverviewPanel({ order }: Readonly<{ order: OrderRecord }>) {
  const lines = [...order.lines].sort((left, right) => left.id.localeCompare(right.id));
  const fulfillment = order.fulfillments[0];
  return (
    <div className="orderdrawerstack">
      <section className="ordersummarynote">
        <p>订单处于{lifecycleLabel(order.lifecycle_state)}状态；金额、支付、履约、退款与审计均来自服务端权威读模型。</p>
        <small>收件人与联系方式只显示下单时固化的脱敏快照，复制与日志均不会暴露明文。</small>
      </section>
      <MilestoneChain order={order} />
      <DetailSection title="商品明细">
        <div className="orderlinepreview">
          {lines.slice(0, 2).map((line) => (
            <div key={line.id}>
              <span className="orderproductthumb"><OrderIcon name="package" /></span>
              <span><strong>{line.title}</strong><small>{chineseReference('商品规格', line.sku)} ×{line.quantity}</small></span>
              <b>{formatMinor(line.payableMinor, order.currency)}</b>
            </div>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="金额与支付">
        <div className="orderdetailgrid">
          <Info label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <Info label="实付金额" value={formatMinor(order.payment.capturedMinor, order.currency)} />
          <Info label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <Info label="可退余额" value={formatMinor(order.payment.refundableMinor, order.currency)} />
        </div>
      </DetailSection>
      <DetailSection title="履约与收货">
        <div className="orderdetailgrid">
          <Info label="履约状态" value={fulfillmentLabel(order.fulfillment_state)} />
          <Info label="履约单" value={fulfillment ? chineseReference('履约单', fulfillment.id) : '尚未创建'} />
          <Info label="供应方" value={providerLabel(fulfillment?.provider ?? order.lines[0]?.provider ?? null, fulfillment?.partner ?? order.lines[0]?.partner ?? null)} />
          <Info label="收货信息" value={addressLabel(order)} />
        </div>
      </DetailSection>
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
        return <li key={item.key} className={`is-${state}`}><span><OrderIcon name={item.complete ? 'check' : item.key === 'shipping' ? 'truck' : 'package'} /></span><strong>{item.label}</strong><small>{item.at ? formatOrderTime(item.at) : '待发生'}</small></li>;
      })}
    </ol>
  );
}

function ProductsPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="商品快照">
        <div className="orderlinelist">
          {[...order.lines].sort((left, right) => left.id.localeCompare(right.id)).map((line) => (
            <article key={line.id}>
              <span className="orderproductthumb"><OrderIcon name="package" /></span>
              <div><strong>{line.title}</strong><small>{chineseReference('商品规格', line.sku)} · {chineseReference('上架记录', line.listing)}</small><small>数量 {line.quantity} · 单价 {formatMinor(line.unitMinor, order.currency)}</small><small>履约来源 {providerLabel(line.provider ?? null, line.partner ?? null)}</small></div>
              <b>{formatMinor(line.payableMinor, order.currency)}</b>
            </article>
          ))}
        </div>
      </DetailSection>
      <DetailSection title="履约单与物流节点">
        {order.fulfillments.length === 0 ? <Empty text="付款完成后将自动创建履约单。" /> : order.fulfillments.map((item) => (
          <article className="orderreadcard" key={item.id}>
            <strong>{chineseReference('履约单', item.id)} · {chineseDomainLabel(item.state)}</strong>
            <small>{providerLabel(item.provider, item.partner)} · {item.externalReferenceMasked ?? '内部履约'}</small>
            {item.milestones.length === 0 ? <span>等待首个物流节点</span> : item.milestones.map((milestone) => <span key={milestone.id}>{formatOrderTime(milestone.occurredAt)} · {chineseDomainLabel(milestone.kind)} · {chineseDomainLabel(milestone.state)} {milestone.trackingMasked ?? ''}</span>)}
          </article>
        ))}
      </DetailSection>
      <DetailSection title="脱敏收货地址"><Empty text={addressLabel(order)} /></DetailSection>
    </div>
  );
}

function PaymentPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="支付汇总">
        <div className="orderdetailgrid">
          <Info label="订单应付" value={formatMinor(order.total_minor, order.currency)} />
          <Info label="实付金额" value={formatMinor(order.payment.capturedMinor, order.currency)} />
          <Info label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} />
          <Info label="可退余额" value={formatMinor(order.payment.refundableMinor, order.currency)} />
        </div>
      </DetailSection>
      <DetailSection title="支付拆分">
        {order.payment.tenders.length === 0 ? <Empty text={order.payment.paymentId ? '本单没有资金拆分记录。' : '订单尚未支付。'} /> : order.payment.tenders.map((tender) => (
          <article className="orderreadcard" key={`${tender.sequence}:${tender.kind}`}><strong>{tenderLabel(tender.kind)} · {formatMinor(tender.amountMinor, order.currency)}</strong><small>{chineseDomainLabel(tender.state)}{tender.referenceMasked ? ` · ${tender.referenceMasked}` : ''}</small></article>
        ))}
      </DetailSection>
      <DetailSection title="退款明细">
        {order.refunds.length === 0 ? <Empty text="本单暂无退款。" /> : order.refunds.map((refund) => (
          <article className="orderreadcard" key={refund.id}><strong>{formatMinor(refund.amountMinor, refund.currency)} · {chineseDomainLabel(refund.state)}</strong><small>{refund.reason} · {refund.provider} · {refund.providerReferenceMasked}</small>{refund.tenders.map((tender) => <span key={`${refund.id}:${tender.sequence}`}>{tenderLabel(tender.kind)} {formatMinor(tender.amountMinor, refund.currency)} · {chineseDomainLabel(tender.state)}</span>)}</article>
        ))}
      </DetailSection>
    </div>
  );
}

function AftersalePanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="售后汇总"><div className="orderdetailgrid"><Info label="聚合售后状态" value={aftersaleLabel(order.aftersale_state)} /><Info label="关联退款" value={`${order.refunds.length} 笔`} /><Info label="已退金额" value={formatMinor(order.payment.refundedMinor, order.currency)} /><Info label="订单版本" value={`第 ${order.version} 版`} /></div></DetailSection>
      <DetailSection title="退款与售后关联">
        {order.refunds.length === 0 ? <Empty text="本单暂无售后退款记录。" /> : order.refunds.map((refund) => <article className="orderreadcard" key={refund.id}><strong>{refund.aftersaleId ? chineseReference('售后单', refund.aftersaleId) : '订单直接退款'}</strong><small>{formatMinor(refund.amountMinor, refund.currency)} · {chineseDomainLabel(refund.state)} · {refund.reason}</small></article>)}
      </DetailSection>
    </div>
  );
}

function OperationsPanel({ order }: Readonly<{ order: OrderRecord }>) {
  return (
    <div className="orderdrawerstack">
      <DetailSection title="写操作审计时间线">
        {order.timeline.length === 0 ? <Empty text="本单暂无需要展示的写操作审计记录。" /> : <ol className="orderaudittimeline">{order.timeline.map((entry) => <li key={entry.id}><strong>{actionLabel(entry.action)}</strong><span>{formatOrderTime(entry.occurredAt)} · {entry.actorMasked}</span><small>{entry.resourceMasked ?? chineseReference('订单', order.id)} · {entry.traceMasked}</small></li>)}</ol>}
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) { return <section className="orderdetailsection"><h3>{title}</h3>{children}</section>; }
function Info({ label, value }: Readonly<{ label: string; value: string }>) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ text }: Readonly<{ text: string }>) { return <p className="orderunavailable"><OrderIcon name="clock" />{text}</p>; }
function providerLabel(provider: string | null, partner: string | null): string { return provider ? chineseProviderLabel(provider) : partner ? chineseReference('合作方', partner) : '平台自营'; }
function tenderLabel(kind: 'wechat' | 'benefit' | 'voucher'): string { return kind === 'wechat' ? '微信支付' : kind === 'benefit' ? '福利账户' : '福利券'; }
function addressLabel(order: OrderRecord): string { return order.address ? `${order.address.recipientMasked} · ${order.address.mobileMasked} · ${order.address.addressMasked}${order.address.regionCode ? `（${order.address.regionCode}）` : ''}` : '本单无需配送地址'; }
function actionLabel(action: string): string { return chineseDomainLabel(action.replaceAll('.', ' ')); }
