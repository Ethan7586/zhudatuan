import { CircleAlert, KeyRound, LoaderCircle, LogOut, ShieldCheck, Smartphone } from 'lucide-react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useSession } from '../../../shared/runtime/SessionContext';
import { ChangeMobile } from '../application/ChangeMobile';
import { ChangePassword } from '../application/ChangePassword';
import { readSecurity } from '../application/ReadSecurity';
import { RevokeSession } from '../application/RevokeSession';
import { securityQuery } from '../application/SecurityQuery';
import { StorefrontStepup } from './StorefrontStepup';
import { textValue } from '../../../shared/format/Text';

export function SecurityPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const password = useRef(new ChangePassword());
  const mobile = useRef(new ChangeMobile());
  const revoke = useRef(new RevokeSession());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState('');
  const [mobileValue, setMobileValue] = useState('');
  const [verification, setVerification] = useState(false);
  const retryAction = useRef<null | (() => Promise<void>)>(null);
  const scope = session.scope || 'guest';
  const query = useQuery({ queryKey: securityQuery(scope), queryFn: ({ signal }) => readSecurity(required(session.session), signal), enabled: session.status === 'authenticated' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: securityQuery(scope) });

  async function run(key: string, action: () => Promise<void>, success?: () => void) {
    setBusy(key);
    setError(null);
    try {
      await action();
      success?.();
      await refresh();
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        retryAction.current = () => run(key, action, success);
        setVerification(true);
      } else setError(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.session) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = textValue(data.get('current'));
    const next = textValue(data.get('next'));
    const confirmation = textValue(data.get('confirmation'));
    await run(
      'password',
      () => password.current.execute(required(session.session), current, next, confirmation),
      () => form.reset()
    );
  }
  async function startMobile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.session) return;
    const form = event.currentTarget;
    if (!challenge) {
      await run('mobile', async () => setChallenge(await mobile.current.start(required(session.session), mobileValue)));
      return;
    }
    const code = textValue(new FormData(form).get('code'));
    await run(
      'mobile',
      () => mobile.current.complete(required(session.session), mobileValue, challenge, code),
      () => {
        setChallenge('');
        setMobileValue('');
        form.reset();
      }
    );
  }
  async function revokeTarget(target: string) {
    if (!session.session) return;
    await run(`session:${target}`, () => revoke.current.execute(required(session.session), target).then(() => undefined));
  }

  function verified() {
    setVerification(false);
    const action = retryAction.current;
    retryAction.current = null;
    if (action) void action();
  }

  return (
    <>
      <section className="sw-web-container mx-auto max-w-[1100px] px-3 py-5 text-xs">
        <header className="mb-4">
          <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">SMART WING SECURITY</p>
          <h1 className="mt-1 text-xl font-black">安全中心</h1>
          <p className="mt-1 text-gray-500">密码、手机号和设备会话均由身份服务实时管理。</p>
        </header>
        {error || query.isError ? (
          <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
            <CircleAlert size={16} />
            {error ?? '安全信息加载失败'}
          </div>
        ) : null}
        {query.isPending ? (
          <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-gray-400">
            <LoaderCircle className="animate-spin" size={17} />
            正在读取安全信息…
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={(event) => void changePassword(event)} className="rounded-xl border bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-black">
                  <KeyRound size={18} />
                  修改密码
                </h2>
                <p className="mt-1 text-gray-500">最近修改：{query.data?.passwordChangedAt ? format(query.data.passwordChangedAt) : '尚未设置本地密码'}</p>
                <input name="current" type="password" autoComplete="current-password" placeholder="当前密码" className="mt-4 w-full rounded-lg border px-3 py-2" />
                <input name="next" type="password" autoComplete="new-password" placeholder="新密码（至少 12 位）" className="mt-2 w-full rounded-lg border px-3 py-2" />
                <input name="confirmation" type="password" autoComplete="new-password" placeholder="再次输入新密码" className="mt-2 w-full rounded-lg border px-3 py-2" />
                <button disabled={busy !== null} className="mt-3 rounded-lg bg-[var(--sw-brand)] px-4 py-2 font-bold text-white disabled:opacity-50">
                  {busy === 'password' ? '正在保存…' : '确认修改'}
                </button>
              </form>
              <form onSubmit={(event) => void startMobile(event)} className="rounded-xl border bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-base font-black">
                  <Smartphone size={18} />
                  更换手机号
                </h2>
                <p className="mt-1 text-gray-500">当前手机号：{query.data?.phoneMasked ?? '未绑定'}</p>
                <input
                  value={mobileValue}
                  onChange={(event) => setMobileValue(event.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="新手机号"
                  disabled={Boolean(challenge)}
                  className="mt-4 w-full rounded-lg border px-3 py-2 disabled:bg-gray-50"
                />
                {challenge ? <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="短信验证码" className="mt-2 w-full rounded-lg border px-3 py-2" /> : null}
                <button disabled={busy !== null} className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                  {busy === 'mobile' ? '正在处理…' : challenge ? '验证并更新' : '发送验证码'}
                </button>
              </form>
            </div>
            <section className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-black">
                    <ShieldCheck size={18} />
                    登录设备
                  </h2>
                  <p className="mt-1 text-gray-500">当前验证等级：L{query.data?.assurance ?? 0}</p>
                </div>
                <button type="button" disabled={busy !== null} onClick={() => void revokeTarget('others')} className="rounded-lg border px-3 py-2 font-bold text-red-600 disabled:opacity-50">
                  撤销其他设备
                </button>
              </div>
              <div className="mt-4 divide-y">
                {query.data?.sessions.map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <b className="text-sm">
                        {item.deviceLabel}
                        {item.current ? '（当前设备）' : ''}
                      </b>
                      <p className="mt-1 max-w-[650px] truncate text-gray-400">{item.userAgent}</p>
                      <p className="mt-1 text-gray-500">
                        最近活动 {format(item.lastSeenAt)} · 到期 {format(item.expiresAt)}
                      </p>
                    </div>
                    {!item.current ? (
                      <button type="button" disabled={busy !== null} onClick={() => void revokeTarget(item.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 font-bold text-red-600 disabled:opacity-50">
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
      <StorefrontStepup
        open={verification}
        onClose={() => {
          setVerification(false);
          retryAction.current = null;
        }}
        onVerified={verified}
      />
    </>
  );
}

function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
function format(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
