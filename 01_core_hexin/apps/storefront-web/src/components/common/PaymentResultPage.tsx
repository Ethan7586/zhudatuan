'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, LoaderCircle, ReceiptText, RefreshCw, ShieldCheck } from 'lucide-react';
import { useMall } from '../../context/MallContext';
import { productionApi, type ApiPaymentResult, type ApiPaymentResultState, ProductionApiError } from '../../services/productionApi';

interface PaymentResultPageProps {
  readonly paymentId: string;
}

const COPY: Readonly<Record<ApiPaymentResultState, Readonly<{ title: string; detail: string; label: string }>>> = Object.freeze({
  preparing: { title: '正在准备支付结果', detail: '订单已经建立，系统正在确认支付渠道状态。', label: '准备中' },
  pending: { title: '支付正在确认', detail: '支付请求已经提交，请不要重复付款。', label: '确认中' },
  recovery: { title: '正在核验渠道结果', detail: '渠道结果暂时不确定，系统会持续查询，不会猜测成功或失败。', label: '核验中' },
  captured: { title: '支付成功', detail: '服务端已经确认到账，订单可以继续履约。', label: '支付成功' },
  failed: { title: '本次支付未完成', detail: '服务端确认本次支付失败，可返回订单重新发起。', label: '支付失败' },
  expired: { title: '支付意图已过期', detail: '本次支付窗口已经结束，可返回订单重新发起。', label: '已过期' },
});

export function paymentResultReadFailure(cause: unknown): Readonly<{ message: string | null; retryAfterMs: number }> {
  if (cause instanceof ProductionApiError && (cause.status === 404 || cause.code === 'NOT_FOUND')) {
    return { message: null, retryAfterMs: 1_000 };
  }
  if (cause instanceof ProductionApiError && cause.status === 0) {
    return { message: cause.message, retryAfterMs: 1_000 };
  }
  return {
    message: cause instanceof ProductionApiError ? cause.message : '支付结果暂时无法读取，系统将自动重试',
    retryAfterMs: 3_000,
  };
}

const PAYMENT_PROGRESS: Readonly<Record<ApiPaymentResultState, number>> = Object.freeze({
  preparing: 0,
  pending: 1,
  recovery: 2,
  captured: 3,
  failed: 3,
  expired: 3,
});

export function selectPaymentResult(previous: ApiPaymentResult | null, next: ApiPaymentResult): ApiPaymentResult {
  if (!previous) return next;
  if (PAYMENT_PROGRESS[previous.state] === 3) return previous;
  return PAYMENT_PROGRESS[next.state] < PAYMENT_PROGRESS[previous.state] ? previous : next;
}

export function PaymentResultPage({ paymentId }: PaymentResultPageProps) {
  const { closePaymentResult, navigateTo, setAndroidPage, setLaptopPage, setMpPage, setTabletPage } = useMall();
  const [result, setResult] = useState<ApiPaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    setRefreshing(true);
    void productionApi.readPaymentResult(paymentId).then((next) => {
      if (!active) return;
      setResult((previous) => selectPaymentResult(previous, next));
      setError(null);
      setRefreshing(false);
      if (next.retryAfter > 0) timer = window.setTimeout(() => setCycle((value) => value + 1), next.retryAfter * 1000);
    }).catch((cause: unknown) => {
      if (!active) return;
      const failure = paymentResultReadFailure(cause);
      setError(failure.message);
      setRefreshing(false);
      timer = window.setTimeout(() => setCycle((value) => value + 1), failure.retryAfterMs);
    });
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [paymentId, cycle]);

  const state = result?.state ?? 'preparing';
  const copy = COPY[state];
  const goToOrders = () => {
    setMpPage('orders');
    setAndroidPage('orders');
    setTabletPage('orders');
    setLaptopPage('orders');
    navigateTo('orders', result ? { orderId: result.orderId } : {});
    closePaymentResult();
  };

  return (
    <section className="min-h-[72vh] bg-[radial-gradient(circle_at_top,#e8f3ff_0%,#f5f7fa_42%,#eef2f6_100%)] px-4 py-10 md:py-16">
      <div className="mx-auto max-w-[720px] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(20,55,90,0.12)]">
        <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-cyan-300" />服务端权威支付结果</div>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-slate-300">自动核验</span>
          </div>
        </div>

        <div className="px-5 py-8 text-center md:px-10 md:py-11">
          <StatusIcon state={state} refreshing={refreshing} />
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{error ? '支付结果读取中断' : copy.title}</h1>
          <p className="mx-auto mt-2 max-w-[520px] text-sm leading-6 text-slate-500">{error ?? copy.detail}</p>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left md:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800"><ReceiptText className="h-4 w-4 text-blue-600" />支付凭据</div>
            <ResultRow label="订单" value={result?.orderId ?? '正在读取'} />
            <ResultRow label="支付标识" value={result?.paymentId ?? paymentId} />
            <ResultRow label="金额" value={result ? `${result.currency} ${(result.amountMinor / 100).toFixed(2)}` : '--'} />
            <ResultRow label="权威状态" value={error ? '等待重新查询' : copy.label} strong />
          </div>

          {state === 'recovery' && !error ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-900">
              请勿重复付款。渠道回调和主动查询正在交叉核验，确认到账后页面会自动更新。
            </div>
          ) : null}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => setCycle((value) => value + 1)} disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />重新查询
            </button>
            <button type="button" onClick={goToOrders}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-bold text-white shadow-lg transition hover:bg-blue-700">
              {state === 'failed' || state === 'expired' ? '返回订单重新支付' : '查看我的订单'}<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ state, refreshing }: Readonly<{ state: ApiPaymentResultState; refreshing: boolean }>) {
  const shell = 'mx-auto flex h-20 w-20 items-center justify-center rounded-[24px]';
  if (refreshing) return <div className={`${shell} bg-blue-50 text-blue-600`}><LoaderCircle className="h-10 w-10 animate-spin" /></div>;
  if (state === 'captured') return <div className={`${shell} bg-emerald-50 text-emerald-600`}><CheckCircle2 className="h-11 w-11" /></div>;
  if (state === 'failed') return <div className={`${shell} bg-red-50 text-red-600`}><CircleAlert className="h-11 w-11" /></div>;
  if (state === 'expired') return <div className={`${shell} bg-slate-100 text-slate-500`}><Clock3 className="h-11 w-11" /></div>;
  if (state === 'recovery') return <div className={`${shell} bg-amber-50 text-amber-600`}><RefreshCw className="h-10 w-10" /></div>;
  return <div className={`${shell} bg-blue-50 text-blue-600`}><Clock3 className="h-11 w-11" /></div>;
}

function ResultRow({ label, value, strong = false }: Readonly<{ label: string; value: string; strong?: boolean }>) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-slate-200/70 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span className="shrink-0 text-xs text-slate-500">{label}</span>
      <span className={`break-all text-right text-xs ${strong ? 'font-black text-slate-950' : 'font-mono text-slate-700'}`}>{value}</span>
    </div>
  );
}
