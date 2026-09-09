import { useState } from 'react';
import { CircleAlert, KeyRound, LoaderCircle, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import { StorefrontStepup } from '..';
import type { useSecurityViewModel } from '../viewmodel/SecurityViewModel';
import { assuranceName, presentDevice } from '../viewmodel/DevicePresentation';

export function SecurityPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useSecurityViewModel> }>) {
  const { state, security, busy, message, challenge, mobileValue, verification, actions } = viewmodel;
  const [expanded, setExpanded] = useState(false);
  const sessions = security?.sessions ?? [];
  const current = sessions.filter((item) => item.current);
  const others = sessions.filter((item) => !item.current);
  const visibleOthers = expanded ? others : others.slice(0, 3);

  return (
    <>
      <section className="sw-web-container mx-auto max-w-[1100px] px-3 py-5 text-xs">
        <header className="mb-4">
          <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 账号安全</p>
          <h1 className="mt-1 text-xl font-black">安全中心</h1>
          <p className="mt-1 text-muted">密码、手机号和设备会话均由身份服务实时管理。</p>
        </header>
        {message ? (
          <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-danger-surface p-3 font-bold text-danger-strong">
            <CircleAlert size={16} />
            {message}
          </div>
        ) : null}
        {state === 'loading' ? (
          <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-muted">
            <LoaderCircle className="animate-spin" size={17} />
            正在读取安全信息…
          </div>
        ) : state === 'failed' ? (
          <div role="alert" className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-surface p-5 text-center text-muted">
            <CircleAlert className="text-danger" />
            <b>安全信息读取失败，当前不会展示推测数据</b>
            <button type="button" onClick={() => void actions.retry()} className="min-h-11 whitespace-nowrap rounded-lg bg-brand-light px-4 font-bold text-brand">
              重试
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={(event) => void actions.changePassword(event)} className="rounded-xl border bg-surface p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-black">
                  <KeyRound size={18} />
                  修改密码
                </h2>
                <p className="mt-1 text-muted">最近修改：{security?.passwordChangedAt ? format(security.passwordChangedAt) : '尚未设置本地密码'}</p>
                <input name="current" required type="password" autoComplete="current-password" placeholder="当前密码" className="mt-4 min-h-11 w-full rounded-lg border px-3" />
                <input name="next" required minLength={12} type="password" autoComplete="new-password" placeholder="新密码（至少 12 位）" className="mt-2 min-h-11 w-full rounded-lg border px-3" />
                <input name="confirmation" required minLength={12} type="password" autoComplete="new-password" placeholder="再次输入新密码" className="mt-2 min-h-11 w-full rounded-lg border px-3" />
                <button type="submit" disabled={busy !== null} className="mt-3 min-h-11 whitespace-nowrap rounded-lg bg-[var(--sw-brand)] px-4 font-bold text-inverse disabled:opacity-50">
                  {busy === 'password' ? '正在保存…' : '确认修改'}
                </button>
              </form>
              <form onSubmit={(event) => void actions.changeMobile(event)} className="rounded-xl border bg-surface p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-black">
                  <Smartphone size={18} />
                  更换手机号
                </h2>
                <p className="mt-1 text-muted">当前手机号：{security?.phoneMasked ?? '未绑定'}</p>
                <input
                  value={mobileValue}
                  onChange={(event) => actions.changeMobileValue(event.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="新手机号"
                  required
                  disabled={Boolean(challenge)}
                  className="mt-4 min-h-11 w-full rounded-lg border px-3 disabled:bg-subtle"
                />
                {challenge ? <input name="code" required minLength={6} maxLength={6} inputMode="numeric" autoComplete="one-time-code" placeholder="6 位短信验证码" className="mt-2 min-h-11 w-full rounded-lg border px-3" /> : null}
                <button type="submit" disabled={busy !== null} className="mt-3 min-h-11 whitespace-nowrap rounded-lg border border-brand bg-brand-light px-4 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                  {busy === 'mobile' ? '正在处理…' : challenge ? '验证并更新' : '发送验证码'}
                </button>
                {challenge ? (
                  <button type="button" disabled={busy !== null} onClick={actions.cancelMobile} className="ml-2 mt-3 min-h-11 whitespace-nowrap rounded-lg border px-4 font-bold text-secondary">
                    取消更换
                  </button>
                ) : null}
              </form>
            </div>
            <section className="mt-4 rounded-xl border bg-surface p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-black">
                    <ShieldCheck size={18} />
                    登录设备
                  </h2>
                  <p className="mt-1 text-muted">当前安全状态：{assuranceName(security?.assurance ?? 0)}</p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null || others.length === 0}
                  onClick={() => void actions.revokeSession('others')}
                  className="min-h-11 whitespace-nowrap rounded-lg border px-3 font-bold text-danger disabled:opacity-50"
                >
                  撤销其他设备
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {current.map((item) => (
                  <DeviceCard key={item.id} item={item} busy={busy !== null} onRevoke={actions.revokeSession} />
                ))}
                {others.length ? <h3 className="pt-1 text-sm font-black">其他已登录设备</h3> : null}
                {visibleOthers.map((item) => (
                  <DeviceCard key={item.id} item={item} busy={busy !== null} onRevoke={actions.revokeSession} />
                ))}
                {others.length > 3 ? (
                  <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-11 w-full whitespace-nowrap rounded-lg border border-edge bg-subtle px-4 font-bold text-brand">
                    {expanded ? '收起其他设备' : `查看其余 ${others.length - 3} 个设备`}
                  </button>
                ) : null}
              </div>
            </section>
          </>
        )}
      </section>
      <StorefrontStepup open={verification} onClose={actions.closeVerification} onVerified={actions.verified} />
    </>
  );
}

function format(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function DeviceCard({ item, busy, onRevoke }: Readonly<{ item: NonNullable<ReturnType<typeof useSecurityViewModel>['security']>['sessions'][number]; busy: boolean; onRevoke: (target: string) => Promise<void> }>) {
  const device = presentDevice(item);
  return (
    <article data-security-device className={`flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-xl border p-3 ${item.current ? 'border-success bg-success-surface' : 'border-edge bg-subtle'}`}>
      <div className="flex min-w-0 flex-[1_1_220px] gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-brand">
          <MonitorSmartphone size={19} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block break-words text-sm">{device.name}</b>
          <p className="mt-1 text-muted">
            {device.clientName} · {device.verification}
            {item.current ? ' · 当前设备' : ''}
          </p>
          <p className="mt-1 text-muted">
            最近使用 {format(item.lastSeenAt)} · {format(item.expiresAt)} 到期
          </p>
          <details className="mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-muted">查看浏览器技术信息</summary>
            <p className="break-words rounded-lg bg-surface p-2 leading-5 text-muted">{device.technical}</p>
          </details>
        </div>
      </div>
      {!item.current ? (
        <button type="button" disabled={busy} onClick={() => void onRevoke(item.id)} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg bg-danger-surface px-3 font-bold text-danger-strong disabled:opacity-50">
          <LogOut size={14} aria-hidden="true" />
          撤销设备
        </button>
      ) : null}
    </article>
  );
}
