import { useEffect, useRef, useState } from 'react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ActivateVoucher } from '../application/ActivateVoucher';
import { activationError, type Activation, type ActivationDraft } from '../model/Activation';
import type { Voucher } from '../model/Voucher';

export function useActivationViewModel(onActivated: (voucher: Voucher) => void, onVerification: () => void) {
  const session = useSession();
  const dependencies = useDependencies();
  const [draft, setDraft] = useState<ActivationDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const identity = JSON.stringify([session.session?.membership, session.session?.scope, session.session?.accessVersion]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  useEffect(() => {
    setDraft(null); setMessage(null); setBusy(false);
    return () => { pending.current?.abort(); pending.current = null; };
  }, [identity]);

  function change(value: Partial<Pick<ActivationDraft, 'mode' | 'number' | 'secret'>>) {
    if (pending.current) return;
    setMessage(null);
    setDraft(current => current ? { ...current, ...value, key: crypto.randomUUID() } : null);
  }
  async function submit() {
    if (pending.current || !draft || !session.session) return;
    const error = activationError(draft);
    if (error) { setMessage(error); return; }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setMessage(null);
    try {
      const voucher = await new ActivateVoucher(dependencies.voucher).execute(session.session, draft, controller.signal);
      if (controller.signal.aborted || currentIdentity.current !== identity) return;
      setDraft(null);
      onActivated(voucher);
      session.showToast('激活成功，卡券已加入当前账号。', 'success');
    } catch (cause) {
      if (controller.signal.aborted || currentIdentity.current !== identity) return;
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) { setMessage('身份验证完成后，请再次点击激活。'); onVerification(); }
      else if (hasFailureCode(cause, 'VOUCHER_SECRET_INVALID')) setMessage('暂时无法激活，请核对激活方式、卡号和券密，或联系发券方。');
      else if (hasFailureCode(cause, 'RATE_LIMITED')) setMessage('尝试次数较多，请稍后再试。');
      else setMessage(presentError(cause).message);
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  return Object.freeze({ draft, busy, message, validation: draft ? activationError(draft) : null,
    actions: Object.freeze({
      open: () => { if (session.session && !pending.current) { setDraft({ mode: 'numbersecret', number: '', secret: '', key: crypto.randomUUID() }); setMessage(null); } },
      close: () => { if (!pending.current) { setDraft(null); setMessage(null); } },
      mode: (mode: Activation['mode']) => change({ mode, number: '', secret: '' }),
      number: (number: string) => change({ number }),
      secret: (secret: string) => change({ secret }),
      submit,
    }),
  });
}
