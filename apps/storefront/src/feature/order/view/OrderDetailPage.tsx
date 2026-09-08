import { ArrowLeft, BellRing, CheckCircle2, CircleAlert, Clock3, Headphones, History, PackageCheck, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import { chineseDomainLabel, chineseProviderLabel } from '@shop/presentation';
import type { useOrderDetailViewModel } from '../viewmodel/OrderDetailViewModel';
import { formatMinor } from '../../../shared/format/Money';
import { afterSaleStateText, fulfillmentStateText, orderStatusText, paymentStateText, timelineStateText } from '../model/OrderText';

export function OrderDetailPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useOrderDetailViewModel> }>) {
  const { order, busy: pending, actions } = viewmodel;
  if (!order)
    return (
      <div className="mx-auto grid min-h-[60dvh] max-w-5xl place-items-center gap-3 p-6 text-center text-sm text-muted" role={viewmodel.state === 'failed' ? 'alert' : 'status'}>
        {viewmodel.state === 'failed' ? <CircleAlert size={24} /> : <RefreshCw className={viewmodel.state === 'loading' ? 'animate-spin' : ''} size={24} />}
        <strong>{viewmodel.state === 'failed' ? '订单详情读取失败' : viewmodel.state === 'empty' ? '没有找到这张订单' : '正在安全加载订单详情…'}</strong>
        {viewmodel.error ? <p>{viewmodel.error}</p> : null}
        {viewmodel.state !== 'loading' ? (
          <button type="button" onClick={actions.refresh} className="rounded-xl bg-brand px-4 py-2 font-bold text-inverse">
            重试
          </button>
        ) : null}
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <button type="button" onClick={actions.back} className="flex items-center gap-1 text-sm font-bold text-brand">
        <ArrowLeft size={16} />
        返回我的订单
      </button>
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-lg font-black">订单详情</h1>
            <p className="mt-1 text-xs text-muted">订单号 {order.orderNo}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-bold text-brand">订单：{orderStatusText(order.status)}</span>
            <span className="rounded-full bg-subtle px-3 py-1 text-xs">支付：{paymentStateText(order.paymentState)}</span>
            <span className="rounded-full bg-subtle px-3 py-1 text-xs">履约：{fulfillmentStateText(order.fulfillmentState)}</span>
            <span className="rounded-full bg-subtle px-3 py-1 text-xs">售后：{afterSaleStateText(order.aftersaleState)}</span>
            {['created', 'awaitingpayment'].includes(order.lifecycleState) && ['unpaid', 'authorizing', 'failed'].includes(order.paymentState) ? (
              <button type="button" disabled={pending !== null} onClick={actions.openCancel} className="rounded-xl border border-danger px-3 py-1 text-xs font-bold text-danger-strong disabled:opacity-50">
                取消订单
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <SectionState title="商品明细" value={order.sections.products} retry={actions.refresh} />
          {order.sections.products.state === 'ready'
            ? order.lines.map((line) => (
                <article key={line.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <div className="grid h-14 w-14 place-items-center rounded-xl bg-subtle">
                    <PackageCheck className="text-muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold">{line.title}</h2>
                    <p className="mt-1 text-xs text-muted">数量 {line.quantity} · 下单商品快照</p>
                    {line.partnerName || line.provider ? <p className="mt-1 text-xs text-muted">履约方：{line.provider ? chineseProviderLabel(line.provider) : line.partnerName}</p> : null}
                  </div>
                  <b className="text-sm">¥{formatMinor(line.payableMinor)}</b>
                </article>
              ))
            : null}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted">订单实付</span>
          <b className="text-xl text-danger">¥{formatMinor(order.totalMinor)}</b>
        </div>
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black">
          <Truck size={18} className="text-brand" />
          物流时间线
        </h2>
        <SectionState title="物流信息" value={order.sections.fulfillment} retry={actions.refresh} />
        {order.sections.fulfillment.state !== 'ready' ? null : order.timeline.length ? (
          <ol className="mt-4 space-y-4 border-l-2 border-brand-light pl-5">
            {order.timeline.map((item) => (
              <li key={item.id} className="relative">
                <CheckCircle2 className="absolute -left-[30px] top-0 bg-surface text-brand" size={18} />
                <b className="text-sm">{timelineStateText(item.state)}</b>
                <p className="mt-1 text-xs text-muted">
                  {new Date(item.occurredAt).toLocaleString('zh-CN')}
                  {item.tracking ? ` · ${item.tracking}` : ''}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-subtle p-4 text-sm text-muted">
            <Clock3 size={17} />
            暂无物流节点，当前为“{fulfillmentStateText(order.fulfillmentState)}”
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {['paid', 'fulfilling'].includes(order.lifecycleState) ? (
            <button type="button" disabled={pending !== null} onClick={() => void actions.remind()} className="flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold text-brand disabled:opacity-50">
              <BellRing size={15} />
              {pending === 'remind' ? '提交中…' : '催发货'}
            </button>
          ) : null}
          {order.status === 'pending_receipt' ? (
            <button type="button" disabled={pending !== null} onClick={() => void actions.receive()} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-inverse disabled:bg-disabled">
              {pending === 'receive' ? '确认中…' : '确认收货'}
            </button>
          ) : null}
          {['completed', 'pending_receipt', 'after_sale'].includes(order.status) ? (
            <button type="button" disabled={pending !== null} onClick={actions.aftersale} className="rounded-xl border px-4 py-2 text-xs font-bold text-brand disabled:opacity-50">
              申请或查看售后
            </button>
          ) : null}
        </div>
      </section>
      <section className="grid gap-3 rounded-2xl bg-surface p-5 shadow-sm sm:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 font-black">
            <ShieldCheck size={18} className="text-brand" />
            支付与退款
          </h2>
          <SectionState title="支付与退款" value={order.sections.payment} retry={actions.refresh} />
          {order.sections.payment.state === 'ready' && order.payment ? (
            <>
              <p className="mt-3 text-xs text-muted">
                实付 ¥{formatMinor(order.payment.capturedMinor)} · 已退 ¥{formatMinor(order.payment.refundedMinor)} · 可退 ¥{formatMinor(order.payment.refundableMinor)}
              </p>
              {order.payment.id && ['unpaid', 'authorizing', 'failed'].includes(order.paymentState) ? (
                <button type="button" onClick={actions.payment} className="mt-3 min-h-11 rounded-xl border px-4 text-xs font-bold text-brand">
                  继续支付或核验状态
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <div>
          <h2 className="font-black">收货快照</h2>
          <p className="mt-3 text-xs text-muted">{order.address ? `${order.address.recipient} · ${order.address.mobile} · ${order.address.detail}` : '本单没有需要展示的收货地址'}</p>
        </div>
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black">售后与客服</h2>
          <div className="flex gap-2">
            {['completed', 'pending_receipt', 'after_sale'].includes(order.status) ? (
              <button type="button" onClick={actions.aftersale} className="min-h-11 rounded-xl border px-4 text-xs font-bold text-brand">
                申请或查看售后
              </button>
            ) : null}
            <button type="button" onClick={actions.support} className="flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold">
              <Headphones size={15} />
              联系订单客服
            </button>
          </div>
        </div>
        <SectionState title="售后信息" value={order.sections.aftersale} retry={actions.refresh} />
        {order.sections.aftersale.state === 'ready' ? <p className="mt-3 text-xs text-muted">当前售后状态：{afterSaleStateText(order.aftersaleState)}。退款到账以服务端支付与退款记录为准。</p> : null}
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-black">
          <History size={18} className="text-brand" />
          订单操作时间线
        </h2>
        <SectionState title="订单时间线" value={order.sections.audit} retry={actions.refresh} />
        {order.sections.audit.state === 'ready' && order.audit.length ? (
          <ol className="mt-4 space-y-3">
            {order.audit.map((item) => (
              <li key={item.id} className="rounded-xl border p-3 text-xs">
                <b>{chineseDomainLabel(item.action, '订单状态已更新')}</b>
                <p className="mt-1 text-muted">
                  {new Date(item.occurredAt).toLocaleString('zh-CN')} · {item.actor}
                </p>
                {item.resource ? <p className="mt-1 text-muted">操作对象：{chineseDomainLabel(item.resourceType, '订单')}</p> : null}
              </li>
            ))}
          </ol>
        ) : order.sections.audit.state === 'ready' ? (
          <p className="mt-3 text-xs text-muted">暂无可展示的订单操作记录</p>
        ) : null}
      </section>
      {viewmodel.error ? (
        <div role="alert" className="rounded-xl bg-danger-surface p-3 text-xs font-bold text-danger-strong">
          {viewmodel.error}
        </div>
      ) : null}
    </div>
  );
}

function SectionState({ title, value, retry }: Readonly<{ title: string; value: Readonly<{ state: string; message?: string; retryable?: boolean }>; retry: () => void }>) {
  if (value.state === 'ready') return null;
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-subtle p-3 text-xs text-muted" role={value.state === 'unavailable' ? 'alert' : 'status'}>
      <CircleAlert size={16} />
      <span>
        <b>{value.state === 'hidden' ? `${title}已按当前权限隐藏` : `${title}暂时不可用`}</b>
        <p className="mt-1">{value.message ?? '其他订单信息仍可继续查看。'}</p>
        {value.retryable ? (
          <button type="button" className="mt-2 font-bold text-brand underline" onClick={retry}>
            重新读取
          </button>
        ) : null}
      </span>
    </div>
  );
}
