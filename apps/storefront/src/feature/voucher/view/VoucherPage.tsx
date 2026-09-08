import { CircleAlert, History, LoaderCircle, TicketCheck } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import { StorefrontStepup } from '../../security';
import type { Voucher } from '../model/Voucher';
import type { useVoucherViewModel } from '../viewmodel/VoucherViewModel';
import { VoucherTimeline } from './VoucherTimeline';
import { date, dateTime, money, stateLabel } from './VoucherText';
import { ActivationDialog } from './ActivationDialog';

export function VoucherPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useVoucherViewModel> }>) {
  const { state, verification, message, actions } = viewmodel;
  return (
    <section className="sw-web-container mx-auto max-w-[1200px] px-3 py-5 text-xs">
      <StorefrontStepup open={verification} onClose={actions.closeVerification} onVerified={actions.verified} />
      <ActivationDialog viewmodel={viewmodel.activation} verification={verification} />
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 我的资产</p>
        <h1 className="mt-1 text-xl font-black">卡券中心</h1>
        <p className="mt-1 text-muted">激活收到的卡券，或选择卡券查看余额、有效期、核销和退款记录。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={viewmodel.activation.actions.open} className="rounded-lg bg-brand px-4 py-2 font-bold text-inverse focus-visible:ring-2 focus-visible:ring-brand">
            激活卡券
          </button>
          <button type="button" onClick={() => void actions.refresh()} className="rounded-lg border bg-surface px-3 py-2 font-bold focus-visible:ring-2 focus-visible:ring-brand">
            刷新卡券
          </button>
        </div>
      </header>
      {message ? <Alert message={message} /> : null}
      {state === 'forbidden' ? (
        <div role="status" className="mb-3 rounded-lg bg-brand-light p-3 font-bold text-brand-dark">
          完成二次验证后即可查看卡券。
        </div>
      ) : null}
      {state === 'loading' ? <State text="正在读取卡券…" busy /> : null}
      {state === 'failed' ? <State text="卡券读取失败，请点击上方刷新重试" /> : null}
      {state === 'ready' || state === 'empty' ? <VoucherContent viewmodel={viewmodel} /> : null}
    </section>
  );
}

function VoucherContent({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useVoucherViewModel> }>) {
  const { vouchers, selected, detail, detailState, actions } = viewmodel;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-black">
          <TicketCheck size={18} />
          我的卡券
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {vouchers.map((item) => (
            <VoucherCard key={item.id} voucher={item} selected={selected === item.id} onSelect={actions.select} />
          ))}
          {vouchers.length === 0 ? <State text="暂无卡券" /> : null}
        </div>
        {viewmodel.hasMore ? (
          <button type="button" onClick={actions.more} disabled={viewmodel.loadingMore} className="mt-3 w-full rounded-lg border bg-surface px-3 py-3 font-bold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand">
            {viewmodel.loadingMore ? '正在加载…' : '加载更多卡券'}
          </button>
        ) : null}
      </div>
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-black">
          <History size={18} />
          卡券详情与动态
        </h2>
        {detailState === 'loading' ? <State text="正在读取卡券详情…" busy /> : null}
        {detailState === 'failed' ? (
          <>
            <State text="卡券详情读取失败，或该卡券不在当前账号中" />
            <button type="button" onClick={actions.retryDetail} className="mt-2 rounded-lg border bg-surface px-3 py-2 font-bold focus-visible:ring-2 focus-visible:ring-brand">
              重试详情
            </button>
          </>
        ) : null}
        {detailState === 'empty' ? <State text="选择一张卡券查看详情" busy={false} /> : null}
        {detailState === 'ready' && detail ? <VoucherDetail voucher={detail} /> : null}
        {selected ? (
          <VoucherTimeline
            items={viewmodel.timeline}
            state={viewmodel.timelineState}
            hasMore={viewmodel.hasMoreTimeline}
            loadingMore={viewmodel.loadingMoreTimeline}
            onMore={() => void actions.moreTimeline()}
            onRetry={() => void actions.retryTimeline()}
            onOpenOrder={(order) => void actions.openOrder(order)}
          />
        ) : null}
      </div>
    </div>
  );
}

function VoucherCard({ voucher, selected, onSelect }: Readonly<{ voucher: Voucher; selected: boolean; onSelect: (voucher: string) => void }>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(voucher.id)}
      className={`relative overflow-hidden rounded-xl border p-4 text-left text-inverse shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand ${selected ? 'border-brand bg-gradient-to-br from-brand to-brand-ink ring-2 ring-brand-light' : 'border-brand-light bg-gradient-to-br from-brand to-brand-ink hover:-translate-y-0.5'}`}
    >
      <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-surface/10" />
      <p className="relative text-inverse-label">{stateLabel(voucher.state)}</p>
      <h3 className="relative mt-1 text-base font-black">{voucher.productName}</h3>
      <p className="relative mt-5 text-2xl font-black text-inverse">{money(voucher.remainingMinor, voucher.currency)}</p>
      <p className="relative mt-1 text-inverse-label">
        初始 {money(voucher.initialMinor, voucher.currency)} · 有效期至 {date(voucher.expiresAt)}
      </p>
      <p className="relative mt-3 truncate text-[10px] text-inverse-label">{voucher.numberMasked}</p>
    </button>
  );
}

function VoucherDetail({ voucher }: Readonly<{ voucher: Voucher }>) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
      <dl className="grid grid-cols-2 gap-3 border-b bg-brand-light/30 p-4">
        <Field label="当前状态" value={stateLabel(voucher.state)} />
        <Field label="可用余额" value={money(voucher.remainingMinor, voucher.currency)} />
        <Field label="生效时间" value={dateTime(voucher.startsAt)} />
        <Field label="失效时间" value={dateTime(voucher.expiresAt)} />
        <div className="col-span-2">
          <Field label="卡券编号" value={voucher.numberMasked} />
        </div>
        <div className="col-span-2">
          <Field label="业务引用" value={chineseReference('卡券', voucher.id)} />
        </div>
      </dl>
    </div>
  );
}

function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 break-all font-bold">{value}</dd>
    </div>
  );
}
function Alert({ message }: Readonly<{ message: string }>) {
  return (
    <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-danger-surface p-3 font-bold text-danger-strong">
      <CircleAlert size={16} />
      {message}
    </div>
  );
}
function State({ text, busy = false }: Readonly<{ text: string; busy?: boolean }>) {
  return (
    <div role="status" className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-dashed bg-surface text-muted">
      {busy ? <LoaderCircle className="animate-spin" size={17} /> : null}
      {text}
    </div>
  );
}
