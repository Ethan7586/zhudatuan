import { CircleAlert, KeyRound, LoaderCircle, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { StorefrontStepup } from '..';
import type { useSecurityViewModel } from '../viewmodel/SecurityViewModel';

export function SecurityPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useSecurityViewModel> }>) {
  const { state, security, busy, message, challenge, mobileValue, verification, actions } = viewmodel;

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
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={(event) => void actions.changePassword(event)} className="rounded-xl border bg-surface p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-black">
                  <KeyRound size={18} />
                  修改密码
                </h2>
                <p className="mt-1 text-muted">最近修改：{security?.passwordChangedAt ? format(security.passwordChangedAt) : '尚未设置本地密码'}</p>
                <input name="current" type="password" autoComplete="current-password" placeholder="当前密码" className="mt-4 w-full rounded-lg border px-3 py-2" />
                <input name="next" type="password" autoComplete="new-password" placeholder="新密码（至少 12 位）" className="mt-2 w-full rounded-lg border px-3 py-2" />
                <input name="confirmation" type="password" autoComplete="new-password" placeholder="再次输入新密码" className="mt-2 w-full rounded-lg border px-3 py-2" />
                <button disabled={busy !== null} className="mt-3 rounded-lg bg-[var(--sw-brand)] px-4 py-2 font-bold text-inverse disabled:opacity-50">
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
                  disabled={Boolean(challenge)}
                  className="mt-4 w-full rounded-lg border px-3 py-2 disabled:bg-subtle"
                />
                {challenge ? <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="短信验证码" className="mt-2 w-full rounded-lg border px-3 py-2" /> : null}
                <button disabled={busy !== null} className="mt-3 rounded-lg border border-brand bg-brand-light px-4 py-2 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                  {busy === 'mobile' ? '正在处理…' : challenge ? '验证并更新' : '发送验证码'}
                </button>
              </form>
            </div>
            <section className="mt-4 rounded-xl border bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-black">
                    <ShieldCheck size={18} />
                    登录设备
                  </h2>
                  <p className="mt-1 text-muted">当前验证等级：L{security?.assurance ?? 0}</p>
                </div>
                <button type="button" disabled={busy !== null} onClick={() => void actions.revokeSession('others')} className="rounded-lg border px-3 py-2 font-bold text-danger disabled:opacity-50">
                  撤销其他设备
                </button>
              </div>
              <div className="mt-4 divide-y">
                {security?.sessions.map((item) => (
                  <article key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <b className="block break-all text-sm">
                        {item.deviceLabel}
                        {item.current ? '（当前设备）' : ''}
                      </b>
                      <p className="mt-1 max-w-[650px] truncate text-muted" title={item.userAgent}>
                        {item.userAgent}
                      </p>
                      <p className="mt-1 text-muted">
                        最近活动 {format(item.lastSeenAt)} · 到期 {format(item.expiresAt)}
                      </p>
                    </div>
                    {!item.current ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void actions.revokeSession(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-danger-surface px-3 py-2 font-bold text-danger-strong disabled:opacity-50"
                      >
                        <LogOut size={14} />
                        撤销
                      </button>
                    ) : null}
                  </article>
                ))}
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
