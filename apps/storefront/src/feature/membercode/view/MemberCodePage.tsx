import { Barcode, QrCode, WingCodeIcon } from '@shop/design';
import { CircleAlert, EyeOff, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Sun, WalletCards } from 'lucide-react';
import type { useMemberCodeViewModel } from '../viewmodel/MemberCodeViewModel';

export function MemberCodePage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useMemberCodeViewModel> }>) {
  const { state, code, remaining, duration, refreshWait, busy, error, display, bright, user, currentMall, actions } = viewmodel;
  return (
    <main className="sw-web-container mx-auto w-full max-w-[1080px] px-3 py-5 sm:px-5 sm:py-8" data-member-code-state={state}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-black tracking-[.16em] text-brand">
            <WingCodeIcon className="h-5 w-5 shrink-0" />
            智慧翼 · 安全会员码
          </p>
          <h1 className="mt-2 text-2xl font-black text-content sm:text-3xl">到店出示，扫码核验</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">会员码每 45 秒自动更新，只用于确认当前福利身份，不会展示手机号或内部编号。</p>
        </div>
        <span className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-success-surface px-3 text-xs font-bold text-success-strong">
          <ShieldCheck size={15} />
          动态加密保护
        </span>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <section className={`overflow-hidden rounded-[28px] bg-surface ${bright ? 'ring-4 ring-brand-light' : ''}`} aria-label="我的会员码">
          <div className="bg-gradient-to-br from-brand-ink via-brand-dark to-brand px-5 py-5 text-inverse sm:px-7">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{currentMall.mallName}</p>
                <p className="mt-1 truncate text-xs text-inverse-label">{user.name} · {currentMall.roleLabel}</p>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface/15">
                <WingCodeIcon className="h-8 w-8" label="智慧翼会员码" />
              </div>
            </div>
          </div>

          <div className={`min-h-[430px] px-4 py-5 transition-colors sm:px-7 ${bright ? 'bg-surface' : 'bg-subtle'}`}>
            {state === 'loading' ? <Loading busy={busy} /> : null}
            {state === 'needsmobile' ? <NeedsMobile onVerify={actions.verifyMobile} /> : null}
            {state === 'failed' ? <Failed message={error ?? '会员码暂时无法生成，请稍后重试。'} busy={busy} onRetry={actions.retry} /> : null}
            {state === 'hidden' ? <Hidden busy={busy} onShow={actions.show} /> : null}
            {state === 'ready' && code ? (
              <>
                <div className="mx-auto grid w-full max-w-[430px] grid-cols-2 rounded-xl bg-brand-light p-1" role="tablist" aria-label="会员码显示方式">
                  <ModeButton active={display === 'qrcode'} label="二维码" onClick={() => actions.display('qrcode')} />
                  <ModeButton active={display === 'barcode'} label="条形码" onClick={() => actions.display('barcode')} />
                </div>
                <div className="mt-4 flex min-h-[268px] items-center justify-center overflow-hidden rounded-3xl bg-surface p-4 sm:p-5">
                  {display === 'qrcode' ? (
                    <QrCode value={code.credential} content="credential" label="动态会员二维码" size={232} className="max-w-full" />
                  ) : (
                    <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-surface p-3">
                      <Barcode value={code.credential} label="动态会员条形码" height={96} />
                      <p className="mt-3 text-center text-xs font-bold tracking-[.16em] text-secondary">请将条形码对准核验设备</p>
                    </div>
                  )}
                </div>
                <div className="mx-auto mt-4 max-w-[430px]" aria-live="polite">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-secondary">{remaining > 0 ? `${remaining} 秒后自动更新` : '正在安全更新…'}</span>
                    <span className="shrink-0 text-muted">无需手动输入</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-light">
                    <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, (remaining / duration) * 100))}%` }} />
                  </div>
                </div>
                {error ? <p role="alert" className="mx-auto mt-4 max-w-[430px] rounded-xl bg-danger-surface px-3 py-2 text-sm leading-5 text-danger-strong">{error} 请重试刚才的操作。</p> : null}
              </>
            ) : null}
          </div>

          {state === 'ready' ? (
            <footer className="grid grid-cols-3 gap-2 border-t border-edge bg-surface p-3 sm:gap-3 sm:p-4">
              <button type="button" disabled={busy || refreshWait > 0} onClick={actions.refresh} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-light px-2 text-xs font-black text-brand disabled:opacity-50 sm:px-4 sm:text-sm">
                <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                {refreshWait > 0 ? `${refreshWait} 秒` : '立即刷新'}
              </button>
              <button type="button" aria-pressed={bright} onClick={actions.brightness} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-subtle px-2 text-xs font-black text-secondary sm:px-4 sm:text-sm">
                <Sun size={16} />
                {bright ? '标准显示' : '高亮显示'}
              </button>
              <button type="button" disabled={busy} onClick={actions.hide} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-subtle px-2 text-xs font-black text-secondary disabled:opacity-50 sm:px-4 sm:text-sm">
                <EyeOff size={16} />
                暂时隐藏
              </button>
            </footer>
          ) : null}
        </section>

        <aside className="space-y-4" aria-label="会员权益摘要">
          <section className="rounded-3xl bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-light text-brand"><Smartphone size={19} /></span>
              <div className="min-w-0">
                <h2 className="font-black text-content">核验身份</h2>
                <p className="mt-1 truncate text-xs text-muted">{user.phoneVerified ? '手机号已认证' : '手机号尚未认证'}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">收银员扫码后只能看到完成服务所需的会员信息；动态凭证过期或隐藏后立即失效。</p>
          </section>
          <section className="rounded-3xl bg-surface p-5">
            <h2 className="flex items-center gap-2 font-black text-content"><WalletCards size={18} className="text-brand" />我的福利</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Balance label="福利余额" value={money(user.welfareBalanceMinor)} />
              <Balance label="餐补余额" value={money(user.mealBalanceMinor)} />
              <Balance label="可用卡券" value={`${user.couponCount} 张`} />
              <Balance label="当前身份" value={currentMall.roleLabel} />
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ModeButton({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-black transition-colors ${active ? 'bg-surface text-brand' : 'text-secondary'}`}>{label}</button>;
}

function Loading({ busy }: Readonly<{ busy: boolean }>) {
  return <div className="grid min-h-[380px] place-items-center text-center"><div><LoaderCircle className="mx-auto animate-spin text-brand" size={34} /><h2 className="mt-4 text-lg font-black text-content">正在生成安全会员码</h2><p className="mt-2 text-sm text-muted">{busy ? '正在连接安全服务，请稍候…' : '正在确认会员身份…'}</p></div></div>;
}

function Failed({ message, busy, onRetry }: Readonly<{ message: string; busy: boolean; onRetry: () => void }>) {
  return <div className="grid min-h-[380px] place-items-center text-center"><div className="max-w-sm"><CircleAlert className="mx-auto text-danger-strong" size={36} /><h2 className="mt-4 text-lg font-black text-content">会员码暂时不可用</h2><p role="alert" className="mt-2 text-sm leading-6 text-muted">{message}</p><button type="button" disabled={busy} onClick={onRetry} className="mt-5 min-h-11 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-black text-inverse disabled:opacity-50">重新生成</button></div></div>;
}

function NeedsMobile({ onVerify }: Readonly<{ onVerify: () => void }>) {
  return <div className="grid min-h-[380px] place-items-center text-center"><div className="max-w-sm"><Smartphone className="mx-auto text-brand" size={38} /><h2 className="mt-4 text-lg font-black text-content">先认证手机号</h2><p className="mt-2 text-sm leading-6 text-muted">为防止会员权益被冒用，首次使用会员码前需要完成手机号认证。</p><button type="button" onClick={onVerify} className="mt-5 min-h-11 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-black text-inverse">前往安全中心</button></div></div>;
}

function Hidden({ busy, onShow }: Readonly<{ busy: boolean; onShow: () => void }>) {
  return <div className="grid min-h-[380px] place-items-center text-center"><div className="max-w-sm"><EyeOff className="mx-auto text-secondary" size={38} /><h2 className="mt-4 text-lg font-black text-content">会员码已隐藏</h2><p className="mt-2 text-sm leading-6 text-muted">上一张会员码已经失效。需要使用时，再生成一张新的动态码。</p><button type="button" disabled={busy} onClick={onShow} className="mt-5 min-h-11 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-black text-inverse disabled:opacity-50">重新显示会员码</button></div></div>;
}

function Balance({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="min-w-0 rounded-2xl bg-subtle p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 truncate text-sm font-black text-content" title={value}>{value}</dd></div>;
}

function money(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value / 100);
}
