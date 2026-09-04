import { useId, useRef } from 'react';
import { Button, Dialog, Form } from '@shop/design';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { voucherCredential } from '@shop/contract/voucher';
import type { useActivationViewModel } from '../viewmodel/ActivationViewModel';

export function ActivationDialog({ viewmodel, verification }: Readonly<{ viewmodel: ReturnType<typeof useActivationViewModel>; verification: boolean }>) {
  const { draft, busy, message, validation, actions } = viewmodel;
  const focus = useRef<HTMLInputElement | null>(null);
  const privacy = useId();
  const help = useId();
  return <Dialog open={draft !== null && !verification} title="激活卡券" eyebrow="卡券中心" onClose={actions.close} dismissable={!busy} initialFocus={focus}
    description="按卡面或发券通知选择激活方式。激活后，卡券将加入当前账号。">
    {draft ? <Form label="激活卡券" onSubmit={event => { event.preventDefault(); void actions.submit(); }} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-2 text-sm font-bold">您收到哪种激活信息？</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold ${draft.mode === 'numbersecret' ? 'border-brand bg-brand-light text-brand-dark' : 'border-edge bg-surface'}`}>
            <input type="radio" name="activationmode" checked={draft.mode === 'numbersecret'} onChange={() => actions.mode('numbersecret')} />卡号＋券密
          </label>
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-bold ${draft.mode === 'secret' ? 'border-brand bg-brand-light text-brand-dark' : 'border-edge bg-surface'}`}>
            <input type="radio" name="activationmode" checked={draft.mode === 'secret'} onChange={() => actions.mode('secret')} />只有券密
          </label>
        </div>
        {draft.mode === 'numbersecret' ? <label className="block text-sm font-bold">卡号
          <input ref={focus} value={draft.number} onChange={event => actions.number(event.target.value)} autoComplete="off" spellCheck={false} maxLength={voucherCredential.number.maximum} aria-describedby={help} aria-invalid={message !== null}
            className="mt-2 w-full rounded-xl border border-edge-strong bg-surface px-4 py-3 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light" placeholder="填写卡面上的完整卡号" required />
        </label> : null}
        <label className="block text-sm font-bold">券密
          <input ref={draft.mode === 'secret' ? focus : undefined} type="password" value={draft.secret} onChange={event => actions.secret(event.target.value)} autoComplete="off" spellCheck={false}
            minLength={voucherCredential.secret.minimum} maxLength={voucherCredential.secret.maximum} aria-describedby={`${privacy} ${help}`} aria-invalid={message !== null} className="mt-2 w-full rounded-xl border border-edge-strong bg-surface px-4 py-3 text-base font-normal focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light" placeholder="填写券密，注意区分大小写" required />
        </label>
      </fieldset>
      <p id={privacy} className="flex items-start gap-2 rounded-xl bg-brand-light/40 p-3 text-xs text-muted"><ShieldCheck size={16} className="shrink-0" />请勿分享券密。关闭窗口将清空填写内容；激活失败不会扣除卡券余额。</p>
      <div id={help}>{message ? <p role="alert" className="rounded-xl bg-danger-surface p-3 text-sm text-danger-strong">{message}</p> : validation ? <p className="text-xs text-muted">{validation}</p> : null}</div>
      <footer className="flex justify-end gap-2"><Button onPress={actions.close} isDisabled={busy}>取消</Button><Button type="submit" tone="primary" isDisabled={busy || validation !== null}>
        <KeyRound size={16} aria-hidden="true" />{busy ? '正在激活…' : '确认激活'}
      </Button></footer>
    </Form> : null}
  </Dialog>;
}
