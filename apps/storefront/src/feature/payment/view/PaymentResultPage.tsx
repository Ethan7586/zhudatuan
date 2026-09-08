import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, RefreshCw } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import type { usePaymentViewModel } from '../viewmodel/PaymentViewModel';

export function PaymentResultPage({ viewmodel, openOrder }: Readonly<{ viewmodel: ReturnType<typeof usePaymentViewModel>; openOrder: (id: string) => void }>) {
  const { valid, continuing, continuationMessage, payment, state, actions } = viewmodel;
  if (!valid) return <State icon={<CircleAlert />} title="支付链接无效" detail="请从订单详情重新进入支付结果页。" />;
  if (state === 'loading') return <State icon={<LoaderCircle className="animate-spin" />} title="正在核验支付状态" detail="请勿关闭页面，系统正在读取权威支付记录。" />;
  if (!payment)
    return (
      <State
        icon={<CircleAlert />}
        title="暂时无法读取支付状态"
        detail="订单不会因此重复扣款，请稍后重试。"
        action={
          <button type="button" onClick={() => void actions.refresh()} className="rounded-full bg-[var(--sw-brand)] px-5 py-2 font-bold text-inverse">
            重新查询
          </button>
        }
      />
    );
  const captured = payment.state === 'captured';
  const terminal = payment.state === 'failed' || payment.state === 'expired';
  return (
    <section className="sw-web-container mx-auto max-w-xl px-4 py-12 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${captured ? 'bg-success-surface text-success-strong' : terminal ? 'bg-danger-surface text-danger-strong' : 'bg-brand-light text-[var(--sw-brand)]'}`}>
        {captured ? <CheckCircle2 size={34} /> : terminal ? <CircleAlert size={34} /> : payment.state === 'recovery' ? <RefreshCw className="animate-spin" size={30} /> : <Clock3 size={30} />}
      </div>
      <h1 className="mt-5 text-xl font-black">{title(payment.state)}</h1>
      <p className="mt-2 text-sm text-muted">{detail(payment.state)}</p>
      {continuationMessage ? <p role="alert" className="mt-4 rounded-xl bg-warning-surface p-3 text-sm text-warning-strong">{continuationMessage}</p> : null}
      <dl className="mt-6 rounded-xl border bg-surface p-4 text-left text-xs">
        <div className="flex justify-between">
          <dt className="text-muted">支付编号</dt>
          <dd>{chineseReference('支付记录', payment.paymentId)}</dd>
        </div>
        <div className="mt-3 flex justify-between">
          <dt className="text-muted">订单编号</dt>
          <dd>{chineseReference('内部订单', payment.orderId)}</dd>
        </div>
        {!terminal && payment.retryAfter > 0 ? <div className="mt-3 flex justify-between"><dt className="text-muted">自动核验</dt><dd>{payment.retryAfter} 秒后按服务端建议重查</dd></div> : null}
        <div className="mt-3 flex justify-between">
          <dt className="text-muted">支付有效期</dt>
          <dd>{new Date(payment.expiresAt).toLocaleString('zh-CN')}</dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-center gap-3">
        {payment.state === 'pending' && payment.action ? (
          <button type="button" disabled={continuing} onClick={() => void actions.continuePayment()} className="rounded-full bg-[var(--sw-brand)] px-6 py-2.5 font-bold text-inverse disabled:opacity-50">
            {continuing ? '正在唤起支付…' : '继续支付'}
          </button>
        ) : null}
        <button type="button" onClick={() => void actions.refresh()} className="rounded-full border px-6 py-2.5 font-bold">
          刷新状态
        </button>
        <button type="button" onClick={() => openOrder(payment.orderId)} className="rounded-full border px-6 py-2.5 font-bold">
          查看订单
        </button>
      </div>
    </section>
  );
}

function State({ icon, title, detail, action }: { readonly icon: React.ReactNode; readonly title: string; readonly detail: string; readonly action?: React.ReactNode }) {
  return (
    <section className="sw-web-container mx-auto grid min-h-[420px] max-w-xl place-items-center px-4 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-light text-[var(--sw-brand)]">{icon}</div>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-muted">{detail}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </section>
  );
}
function title(state: string) {
  return ({ captured: '支付成功', pending: '等待完成支付', preparing: '正在准备支付', recovery: '正在恢复支付状态', failed: '支付未完成', expired: '支付已过期' } as Record<string, string>)[state] ?? '支付处理中';
}
function detail(state: string) {
  return (
    (
      {
        captured: '款项已确认，订单将进入履约流程。',
        pending: '请完成受控支付动作，页面会自动核验结果。',
        preparing: '支付通道正在准备，请稍候。',
        recovery: '支付结果尚未确定，系统正在主动查询，不会猜测成功或失败。',
        failed: '本次支付未完成，可返回订单重新发起。',
        expired: '支付意图已过期，库存与权益将按流程释放。',
      } as Record<string, string>
    )[state] ?? '请稍候。'
  );
}
