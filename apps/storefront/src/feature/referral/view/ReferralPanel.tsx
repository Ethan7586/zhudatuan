import { ArrowLeft, CircleAlert, LoaderCircle, RefreshCw, Users } from 'lucide-react';
import { StorefrontStepup } from '../../security';
import { ReferralActions } from './ReferralActions';
import { ReferralSummary } from './ReferralSummary';
import type { useReferralViewModel } from '../viewmodel/ReferralViewModel';

export function ReferralPanel({ viewmodel, back }: Readonly<{ viewmodel: ReturnType<typeof useReferralViewModel>; back: () => void }>) {
  const { state, withdrawalState, summary, commissions, withdrawals, hasMoreCommissions, hasMoreWithdrawals, loadingCommissions, loadingWithdrawals, message, busy, link, verification, actions } = viewmodel;
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
          <ArrowLeft size={16} />
          返回个人中心
        </button>
        <button type="button" onClick={() => void actions.retry()} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold">
          <RefreshCw size={14} />
          刷新
        </button>
      </header>
      <section className="rounded-2xl bg-gradient-to-br from-brand-ink to-brand p-5 text-inverse shadow-lg">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <Users />
          推荐有礼
        </h1>
        <p className="mt-2 text-sm text-inverse-label">真实收益、专属推荐链接、申请与提现在同一处完成。</p>
      </section>
      {message ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-surface p-3 text-xs font-bold text-danger-strong">
          <CircleAlert size={16} />
          {message}
        </div>
      ) : null}
      {state === 'loading' || withdrawalState === 'loading' ? <PanelState text="正在读取推荐账户…" /> : null}
      {state === 'failed' || withdrawalState === 'failed' ? <PanelState text="推荐账户加载失败，请重试" retry={() => void actions.retry()} /> : null}
      {state === 'ready' && withdrawalState === 'ready' && summary ? (
        <>
          <ReferralSummary summary={summary} commissions={commissions} loading={loadingCommissions} hasMore={hasMoreCommissions} loadMore={() => void actions.loadCommissions()} />
          <ReferralActions
            availableMinor={summary.availableMinor}
            currency={summary.currency}
            withdrawals={withdrawals}
            link={link}
            busy={busy}
            loading={loadingWithdrawals}
            hasMore={hasMoreWithdrawals}
            apply={(event) => void actions.apply(event)}
            withdraw={(event) => void actions.withdraw(event)}
            generate={() => void actions.generateLink()}
            share={() => void actions.shareLink()}
            closeLink={actions.closeLink}
            loadMore={() => void actions.loadWithdrawals()}
          />
        </>
      ) : null}
      <StorefrontStepup open={verification} onClose={actions.closeVerification} onVerified={actions.verified} />
    </div>
  );
}

function PanelState({ text, retry }: Readonly<{ text: string; retry?: () => void }>) {
  return (
    <div role={retry ? 'alert' : 'status'} className="grid min-h-32 place-items-center rounded-2xl border border-dashed bg-surface text-sm text-muted">
      {retry ? <CircleAlert /> : <LoaderCircle className="animate-spin" />}
      <span>{text}</span>
      {retry ? (
        <button type="button" onClick={retry} className="rounded-lg bg-brand-light px-3 py-2 font-bold text-brand">
          重试
        </button>
      ) : null}
    </div>
  );
}
