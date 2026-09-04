import type { FailureView } from '@shop/presentation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bootstrap } from '../../bootstrap';
import { challengeNotice, useCooldown, type Challenge } from '../../challenge';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import type { ActionResult } from '../../../shared/ui/ActionResult';

export function useRecoveryViewModel(
  bootstrap: Bootstrap,
  onChallenge: (destination: string) => Promise<ActionResult<Challenge>>,
  onReset: (challenge: string, code: string, password: string) => Promise<ActionResult<void>>,
  onClose: () => void
) {
  const [mobile, setMobile] = useState('');
  const [challenge, setChallenge] = useState<Challenge>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState<FailureView>();
  const [issue, setIssue] = useState('');
  const password = useMemo(() => new Secret(), []);
  const confirm = useMemo(() => new Secret(), []);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const cooldown = useCooldown();
  useEffect(
    () => () => {
      clearSecretInput(passwordInput.current, password);
      clearSecretInput(confirmInput.current, confirm);
    },
    [confirm, password]
  );
  const changeMobile = (value: string) => {
    setMobile(value);
    setChallenge(undefined);
    setIssue('');
    cooldown.clear();
  };
  const send = async () => {
    if (!mobile.trim()) {
      setIssue('请输入登录账号或已绑定手机号。');
      mobileInput.current?.focus();
      return;
    }
    setBusy(true);
    setIssue('');
    try {
      const result = await onChallenge(mobile);
      if (!result.ok) return setFailure(result.failure);
      setFailure(undefined);
      setChallenge(result.value);
      setCode('');
      cooldown.start(result.value.resendSeconds);
      setNotice(challengeNotice(result.value, true));
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    const first = password.take();
    const second = confirm.take();
    try {
      if (!/^\d{6}$/.test(code)) return setIssue('请输入 6 位短信验证码。');
      if (first !== second) return setIssue('两次输入的密码不一致。');
      if (!strong(first, bootstrap.password)) return setIssue('新密码不符合当前安全要求，请按输入提示修改。');
      setIssue('');
      setBusy(true);
      if (challenge === undefined) return setIssue('请先获取短信验证码。');
      const result = await onReset(challenge.id, code, first);
      if (!result.ok) setFailure(result.failure);
    } finally {
      setBusy(false);
      clearSecretInput(passwordInput.current, password);
      clearSecretInput(confirmInput.current, confirm);
    }
  };
  const close = () => {
    if (busy) return;
    setMobile('');
    setChallenge(undefined);
    setCode('');
    setNotice('');
    setIssue('');
    setFailure(undefined);
    cooldown.clear();
    clearSecretInput(passwordInput.current, password);
    clearSecretInput(confirmInput.current, confirm);
    onClose();
  };
  return Object.freeze({
    bootstrap,
    mobile,
    challenge,
    code,
    busy,
    notice,
    failure,
    issue,
    seconds: cooldown.seconds,
    passwordInput,
    confirmInput,
    mobileInput,
    changeMobile,
    setCode,
    setPassword: (value: string) => password.set(value),
    setConfirm: (value: string) => confirm.set(value),
    send,
    submit,
    close,
  });
}

export type RecoveryViewModel = ReturnType<typeof useRecoveryViewModel>;

function strong(value: string, policy: Bootstrap['password']): boolean {
  return (
    value.length >= policy.minimumLength &&
    value.length <= policy.maximumLength &&
    (!policy.uppercase || /[A-Z]/.test(value)) &&
    (!policy.lowercase || /[a-z]/.test(value)) &&
    (!policy.number || /\d/.test(value)) &&
    (!policy.symbol || /[^A-Za-z0-9]/.test(value))
  );
}
