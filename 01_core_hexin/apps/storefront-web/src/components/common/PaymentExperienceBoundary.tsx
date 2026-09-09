'use client';

import React from 'react';
import type { PaymentRecoveryRecord } from '../../services/paymentRecovery';

interface PaymentExperienceBoundaryProps {
  readonly children: React.ReactNode;
  readonly paymentId: string;
  readonly onRecover: () => void;
  readonly onViewOrders: () => void;
}

interface PaymentExperienceBoundaryState {
  readonly cause: unknown | null;
}

export type PaymentExperienceFailureKind = 'asset' | 'render';

export function paymentExperienceFailureKind(cause: unknown): PaymentExperienceFailureKind {
  const name = cause instanceof Error ? cause.name : '';
  const message = cause instanceof Error ? cause.message : String(cause ?? '');
  return name === 'ChunkLoadError'
    || /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported module/iu.test(message)
    ? 'asset'
    : 'render';
}

export class PaymentExperienceBoundary extends React.Component<PaymentExperienceBoundaryProps, PaymentExperienceBoundaryState> {
  state: PaymentExperienceBoundaryState = { cause: null };

  static getDerivedStateFromError(cause: unknown): PaymentExperienceBoundaryState {
    return { cause };
  }

  componentDidUpdate(previous: PaymentExperienceBoundaryProps) {
    if (previous.paymentId !== this.props.paymentId && this.state.cause !== null) this.setState({ cause: null });
  }

  render() {
    if (this.state.cause === null) return this.props.children;
    return (
      <PaymentRecoverySurface
        kind={paymentExperienceFailureKind(this.state.cause)}
        onRecover={this.props.onRecover}
        onViewOrders={this.props.onViewOrders}
      />
    );
  }
}

export function PaymentRecoverySurface({ kind, onRecover, onViewOrders }: Readonly<{
  kind: PaymentExperienceFailureKind;
  onRecover: () => void;
  onViewOrders: () => void;
}>) {
  return (
    <section
      role="alert"
      data-payment-recovery-surface="true"
      className="flex min-h-full items-center bg-[radial-gradient(circle_at_50%_12%,#edf6ff_0%,#f5f7fa_46%,#f1f4f8_100%)] px-5 py-8"
    >
      <div className="mx-auto w-full max-w-sm rounded-[28px] border border-white/90 bg-white/95 px-6 py-8 text-center shadow-[0_22px_70px_rgba(28,72,132,0.12)]">
        <div aria-hidden="true" className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EDF5FF] text-[#1F5EFF] shadow-[inset_0_0_0_1px_rgba(31,94,255,0.08)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 9.5h14v9H5z" /><path d="M8 9.5V7.8A4 4 0 0 1 12 4a4 4 0 0 1 4 3.8v1.7" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-black tracking-tight text-[#172033]">支付状态仍可恢复</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {kind === 'asset' ? '支付页面刚刚更新，但订单已经保留。' : '支付状态暂时没有显示完整，但订单已经保留。'}
          请先确认支付结果，不要重复付款。
        </p>
        <div className="mt-7 grid gap-3">
          <button type="button" onClick={onRecover} className="min-h-12 rounded-2xl bg-[#1F5EFF] px-5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(31,94,255,0.24)] transition active:scale-[0.985]">
            恢复支付状态
          </button>
          <button type="button" onClick={onViewOrders} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition active:bg-slate-50">
            查看我的订单
          </button>
        </div>
      </div>
    </section>
  );
}

export function PaymentStableCarrier({ session }: Readonly<{ session: PaymentRecoveryRecord }>) {
  const title = stableCarrierTitle(session.stage);
  const amount = session.currency === 'CNY'
    ? `¥${(session.amountMinor / 100).toFixed(2)}`
    : `${session.currency} ${(session.amountMinor / 100).toFixed(2)}`;
  return (
    <section
      data-payment-stable-carrier="true"
      aria-busy="true"
      aria-label={title}
      className="flex min-h-[72vh] items-start bg-[radial-gradient(circle_at_50%_-8%,rgba(210,232,255,0.95)_0%,rgba(244,248,252,0.98)_36%,#f5f7fa_72%)] px-4 py-8 motion-safe:animate-[paymentCarrierIn_160ms_ease-out]"
    >
      <div className="mx-auto w-full max-w-[680px] overflow-hidden rounded-[30px] border border-white/90 bg-white/95 shadow-[0_24px_72px_rgba(31,78,126,0.11)]">
        <div className="flex items-center justify-between border-b border-slate-100/80 px-5 py-4">
          <span className="truncate text-sm font-semibold text-slate-700">{session.mallName}</span>
          <span className="rounded-full bg-[#f4f8ff] px-3 py-1 text-[11px] font-medium text-[#5175a4]">微信支付</span>
        </div>
        <div className="px-5 pb-9 pt-10 text-center">
          <div aria-hidden="true" className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#dceeff]/80 blur-2xl motion-safe:animate-[pulse_2.8s_ease-in-out_infinite]" />
            <span className="absolute h-[76px] w-[76px] rounded-full border border-[#cfe3f8] bg-white/70 shadow-[inset_0_0_18px_rgba(181,218,249,0.42),0_8px_30px_rgba(72,139,203,0.12)]" />
            <span className="relative h-[52px] w-[52px] rounded-[52%_48%_58%_42%/46%_55%_45%_54%] border border-white bg-[linear-gradient(145deg,#fff,rgba(213,235,255,0.8))] shadow-[0_10px_24px_rgba(74,139,197,0.16)] motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]" />
          </div>
          <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-[#6483a8]">订单已为你保留</p>
          <h1 className="mt-2 text-[25px] font-bold tracking-tight text-[#13233a]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">支付状态正在安全衔接，请勿重复付款。</p>
          <div className="mt-7 rounded-[22px] border border-[#e9f1fb] bg-[#f5f9fe] px-5 py-5">
            <p className="text-[11px] font-medium text-slate-400">本次支付</p>
            <p className="mt-1 text-[38px] font-bold tabular-nums tracking-[-0.04em] text-[#14243b]">{amount}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function stableCarrierTitle(stage: PaymentRecoveryRecord['stage']): string {
  if (stage === 'wechat-active') return '请在微信中完成支付';
  if (stage === 'verifying' || stage === 'recovery') return '正在确认到账';
  if (stage === 'cancelled') return '订单已为你保留';
  if (stage === 'captured') return '支付成功';
  if (stage === 'failed' || stage === 'expired') return '本次支付未完成';
  return '正在打开微信支付';
}
