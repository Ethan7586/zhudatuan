import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useSession } from '../../../shared/runtime/SessionContext';
import { ContinuePayment } from '../application/ContinuePayment';
import { readPayment } from '../application/ReadPayment';

export function PaymentResultPage() {
  const { paymentId = '' } = useParams();
  const session = useSession();
  const continuation = useRef(new ContinuePayment());
  const [continuing, setContinuing] = useState(false);
  const valid = /^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(paymentId);
  const query = useQuery({
    queryKey: ['storefront', session.scope || 'guest', 'payment', paymentId],
    queryFn: ({ signal }) => readPayment(session.session!, paymentId, signal),
    enabled: valid && session.status === 'authenticated',
    refetchInterval: ({ state }) => {
      const payment = state.data;
      if (!payment || ['captured', 'failed', 'expired'].includes(payment.state)) return false;
      return Math.max(2, payment.retryAfter ?? 5) * 1000;
    },
  });
  if (!valid) return <State icon={<CircleAlert />} title="支付链接无效" detail="请从订单详情重新进入支付结果页。" />;
  if (query.isPending) return <State icon={<LoaderCircle className="animate-spin" />} title="正在核验支付状态" detail="请勿关闭页面，系统正在读取权威支付记录。" />;
  if (query.isError || !query.data)
    return (
      <State
        icon={<CircleAlert />}
        title="暂时无法读取支付状态"
        detail="订单不会因此重复扣款，请稍后重试。"
        action={
          <button type="button" onClick={() => void query.refetch()} className="rounded-full bg-[var(--sw-brand)] px-5 py-2 font-bold text-white">
            重新查询
          </button>
        }
      />
    );
  const payment = query.data;
  const captured = payment.state === 'captured';
  const terminal = payment.state === 'failed' || payment.state === 'expired';
  const continuePayment = async () => {
    if (!payment.action) return;
    setContinuing(true);
    try {
      await continuation.current.execute(payment.action);
    } finally {
      setContinuing(false);
      await query.refetch();
    }
  };
  return (
    <section className="sw-web-container mx-auto max-w-xl px-4 py-12 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${captured ? 'bg-emerald-50 text-emerald-600' : terminal ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[var(--sw-brand)]'}`}>
        {captured ? <CheckCircle2 size={34} /> : terminal ? <CircleAlert size={34} /> : payment.state === 'recovery' ? <RefreshCw className="animate-spin" size={30} /> : <Clock3 size={30} />}
      </div>
      <h1 className="mt-5 text-xl font-black">{title(payment.state)}</h1>
      <p className="mt-2 text-sm text-gray-500">{detail(payment.state)}</p>
      <dl className="mt-6 rounded-xl border bg-white p-4 text-left text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-400">支付编号</dt>
          <dd className="font-mono">{payment.paymentId}</dd>
        </div>
        <div className="mt-3 flex justify-between">
          <dt className="text-gray-400">订单编号</dt>
          <dd className="font-mono">{payment.orderId}</dd>
        </div>
        <div className="mt-3 flex justify-between">
          <dt className="text-gray-400">支付有效期</dt>
          <dd>{new Date(payment.expiresAt).toLocaleString('zh-CN')}</dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-center gap-3">
        {payment.state === 'pending' && payment.action ? (
          <button type="button" disabled={continuing} onClick={() => void continuePayment()} className="rounded-full bg-[var(--sw-brand)] px-6 py-2.5 font-bold text-white disabled:opacity-50">
            {continuing ? '正在唤起支付…' : '继续支付'}
          </button>
        ) : null}
        <button type="button" onClick={() => void query.refetch()} className="rounded-full border px-6 py-2.5 font-bold">
          刷新状态
        </button>
        <Link to={`/orders/${encodeURIComponent(payment.orderId)}`} className="rounded-full border px-6 py-2.5 font-bold">
          查看订单
        </Link>
      </div>
    </section>
  );
}

function State({ icon, title, detail, action }: { readonly icon: React.ReactNode; readonly title: string; readonly detail: string; readonly action?: React.ReactNode }) {
  return (
    <section className="sw-web-container mx-auto grid min-h-[420px] max-w-xl place-items-center px-4 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-[var(--sw-brand)]">{icon}</div>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{detail}</p>
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
