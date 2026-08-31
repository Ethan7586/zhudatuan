import { CircleCheck, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { productionError } from '../../../shared/failure/Failure';
import { useSession } from '../../../shared/runtime/SessionContext';
import { StepupGateway } from '../infrastructure/StepupGateway';

export interface StorefrontStepupProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onVerified: () => void;
}

export function StorefrontStepup({ open, onClose, onVerified }: StorefrontStepupProps) {
  const session = useSession();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) return;
    setChallenge(null);
    setCode('');
    setError(null);
  }, [open]);
  if (!open) return null;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      setChallenge((await StepupGateway.start(session.session)).id);
      setCode('');
    } catch (cause) {
      setError(productionError(cause).message || '验证码发送失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      const result = await StepupGateway.complete(session.session, challenge, code);
      if (result.assurance < 3) throw new Error('STEPUP_ASSURANCE_INVALID');
      onVerified();
    } catch (cause) {
      setError(productionError(cause).message || '验证失败，请检查验证码后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="storefront-stepup-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl">
        <header className="relative bg-gradient-to-br from-blue-700 to-indigo-700 px-6 py-6 text-white">
          <button type="button" aria-label="关闭二次验证" disabled={busy} onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 hover:bg-white/25 disabled:opacity-50">
            <X size={18} />
          </button>
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/15">
            <ShieldCheck size={26} />
          </div>
          <h2 id="storefront-stepup-title" className="text-xl font-black">
            确认是你本人操作
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-100">为保护账户和本次关键操作，需要验证当前账号绑定的手机号。验证结果 15 分钟内有效。</p>
        </header>
        <div className="space-y-4 p-6">
          {challenge === null ? (
            <>
              <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <CircleCheck className="mt-0.5 shrink-0" size={18} />
                <div>
                  <b>验证码只用于本次身份确认</b>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">不会修改密码，也不会向任何人展示完整手机号。</p>
                </div>
              </div>
              <button type="button" disabled={busy} onClick={() => void send()} className="w-full rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">
                {busy ? '正在发送…' : '发送验证码'}
              </button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void verify(event)}>
              <div role="status" className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
                <b>验证码已发送</b>
                <p className="mt-1 text-xs leading-5 text-blue-700">请输入当前账号绑定手机收到的 6 位验证码。</p>
              </div>
              <label className="block text-sm font-bold text-slate-800">
                6 位验证码
                <input
                  aria-label="二次验证验证码"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={busy}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => void send()} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">
                  重新发送
                </button>
                <button type="submit" disabled={busy || code.length !== 6} className="rounded-xl bg-[var(--sw-brand)] px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                  {busy ? '正在验证…' : '确认验证'}
                </button>
              </div>
            </form>
          )}
          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
