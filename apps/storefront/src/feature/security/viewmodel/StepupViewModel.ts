import { useEffect, useState, type FormEvent } from 'react';
import { presentError, presentFailure } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';

export function useStepupViewModel(open: boolean, onVerified: () => void) {
  const dependencies = useDependencies();
  const session = useSession();
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!open) {
      setChallenge(null);
      setCode('');
      setError(null);
      setPhoneMasked(undefined);
      return;
    }
    if (!session.session) return;
    const controller = new AbortController();
    void dependencies.stepup
      .phoneMasked(session.session, controller.signal)
      .then(setPhoneMasked)
      .catch((cause) => setError(presentError(cause).message));
    return () => controller.abort();
  }, [dependencies.stepup, open, session.session]);
  async function send() {
    setBusy(true);
    setError(null);
    try {
      if (!session.session) return setError(presentFailure({ kind: 'client', code: 'SESSION_CONTEXT_MISSING', retryable: false }).message);
      if (phoneMasked === null) return setError('当前账号未绑定手机号，请先在安全中心完成绑定。');
      setChallenge((await dependencies.stepup.start(session.session)).id);
      setCode('');
    } catch (cause) {
      setError(presentError(cause).message);
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
      if (!session.session) return setError(presentFailure({ kind: 'client', code: 'SESSION_CONTEXT_MISSING', retryable: false }).message);
      const result = await dependencies.stepup.complete(session.session, challenge, code);
      if (result.assurance < 3) return setError('身份验证未达到安全要求，请重新获取验证码。');
      onVerified();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  return Object.freeze({ challenge, code, busy, error, phoneMasked, actions: Object.freeze({ send, verify, changeCode: (value: string) => setCode(value.replace(/\D/g, '').slice(0, 6)) }) });
}
