import { useRef } from 'react';
import { CircleCheck, ShieldCheck } from 'lucide-react';
import { Button, Dialog } from '@shop/design';
import type { useStepupViewModel } from '../viewmodel/StepupViewModel';

export interface StorefrontStepupProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly viewmodel: ReturnType<typeof useStepupViewModel>;
}

export function StorefrontStepup({ open, onClose, viewmodel }: StorefrontStepupProps) {
  const { challenge, code, busy, error, phoneMasked, actions } = viewmodel;
  const sendFocus = useRef<HTMLButtonElement>(null);
  const codeFocus = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open={open}
      title="确认是你本人操作"
      description="为保护账户和本次关键操作，需要验证当前账号绑定的手机号。验证结果 15 分钟内有效。"
      icon={<ShieldCheck size={26} />}
      tone="secure"
      closeLabel="关闭二次验证"
      dismissable={!busy}
      initialFocus={challenge === null ? sendFocus : codeFocus}
      onClose={onClose}
    >
      <div className="space-y-4">
        {challenge === null ? (
          <>
            <div className="flex gap-3 rounded-2xl bg-success-surface p-4 text-sm text-success-strong">
              <CircleCheck className="mt-0.5 shrink-0" size={18} />
              <div>
                <b>验证码只用于本次身份确认</b>
                <p className="mt-1 text-xs leading-5 text-success-strong">
                  {phoneMasked === undefined ? '正在确认当前账号绑定的手机号…' : phoneMasked === null ? '当前账号未绑定手机号，请先在安全中心完成绑定。' : `验证码将发送到 ${phoneMasked}，不会展示完整手机号。`}
                </p>
              </div>
            </div>
            <Button ref={sendFocus} tone="primary" isDisabled={busy || phoneMasked == null} onPress={() => void actions.send()} className="w-full">
              {busy ? '正在发送…' : '发送验证码'}
            </Button>
          </>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void actions.verify(event)}>
            <div role="status" className="rounded-2xl bg-brand-light p-4 text-sm text-brand-dark">
              <b>验证码已发送</b>
              <p className="mt-1 text-xs leading-5 text-brand">请输入当前账号绑定手机收到的 6 位验证码。</p>
            </div>
            <label className="block text-sm font-bold text-content">
              6 位验证码
              <input
                ref={codeFocus}
                aria-label="二次验证验证码"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => actions.changeCode(event.target.value)}
                disabled={busy}
                className="mt-2 min-h-11 w-full rounded-xl border border-edge-strong px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-brand focus:ring-4 focus:ring-brand-light"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" isDisabled={busy} onPress={() => void actions.send()}>
                重新发送
              </Button>
              <Button type="submit" tone="primary" isDisabled={busy || code.length !== 6}>
                {busy ? '正在验证…' : '确认验证'}
              </Button>
            </div>
          </form>
        )}
        {error ? (
          <p role="alert" className="rounded-xl bg-danger-surface p-3 text-xs font-bold text-danger-strong">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
