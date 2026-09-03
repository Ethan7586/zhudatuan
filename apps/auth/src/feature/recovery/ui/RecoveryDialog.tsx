import { Button, Dialog } from '@shop/design';
import type { FailureView } from '@shop/presentation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bootstrap } from '../../bootstrap/model/Bootstrap';
import type { Challenge } from '../../challenge/model/Challenge';
import { challengeNotice } from '../../challenge/model/Challenge';
import { CodeField } from '../../challenge/ui/CodeField';
import { useCooldown } from '../../challenge/ui/useCooldown';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import { Alert } from '../../../shared/ui/Alert';
import type { ActionResult } from '../../../shared/ui/ActionResult';

export function RecoveryDialog({ open, bootstrap, failure, onChallenge, onReset, onClose }: Readonly<{ open: boolean; bootstrap: Bootstrap; failure?: FailureView; onChallenge: (destination: string) => Promise<ActionResult<Challenge>>; onReset: (challenge: string, code: string, password: string) => Promise<ActionResult<void>>; onClose: () => void }>) {
  const [mobile, setMobile] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionFailure, setActionFailure] = useState<FailureView>();
  const [fieldIssue, setFieldIssue] = useState('');
  const password = useMemo(() => new Secret(), []);
  const confirm = useMemo(() => new Secret(), []);
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);
  const cooldown = useCooldown();
  useEffect(() => () => { clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); }, [confirm, password]);
  const send = async () => {
    if (!mobile.trim()) { setFieldIssue('请输入登录账号或已绑定手机号。'); mobileInput.current?.focus(); return; }
    setBusy(true);
    setFieldIssue('');
    try {
      const value = await onChallenge(mobile);
      if (!value.ok) return setActionFailure(value.failure);
      setActionFailure(undefined); setChallenge(value.value.id); setCode(''); cooldown.start(value.value.resendSeconds); setNotice(challengeNotice(value.value.validSeconds, value.value.resendSeconds, true));
    } finally { setBusy(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const first = password.take();
    const second = confirm.take();
    try {
      if (!/^\d{6}$/.test(code)) return setFieldIssue('请输入 6 位短信验证码。');
      if (first !== second) return setFieldIssue('两次输入的密码不一致。');
      if (!strong(first, bootstrap.password)) return setFieldIssue('新密码不符合当前安全要求，请按输入提示修改。');
      setFieldIssue('');
      setBusy(true);
      const result = await onReset(challenge, code, first);
      if (!result.ok) setActionFailure(result.failure);
    } finally {
      setBusy(false);
      clearSecretInput(passwordInput.current, password);
      clearSecretInput(confirmInput.current, confirm);
    }
  };
  const close = () => {
    if (busy) return;
    setMobile(''); setChallenge(''); setCode(''); setNotice(''); setFieldIssue(''); setActionFailure(undefined); cooldown.clear();
    clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); onClose();
  };
  return <Dialog open={open} title="找回密码" eyebrow="安全验证" description="验证绑定手机号后重置密码，完成后所有旧设备立即下线。" initialFocus={mobileInput} onClose={close} dismissable={!busy}><form className="authdialogform" onSubmit={(event) => void submit(event)}>
    {failure !== undefined ? <Alert failure={failure} /> : actionFailure !== undefined ? <Alert failure={actionFailure} /> : null}{notice ? <Alert notice={notice} /> : null}
    {fieldIssue ? <p className="authfieldissue" role="alert">{fieldIssue}</p> : null}
    <label className="authfield">登录账号或已绑定手机号<input ref={mobileInput} value={mobile} onChange={(event) => { setMobile(event.target.value); setChallenge(''); setFieldIssue(''); cooldown.clear(); }} autoComplete="username" placeholder="登录账号或已绑定手机号" className="authinput" disabled={busy} /></label>
    <label className="authfield">短信验证码<div className="authcodegroup"><CodeField value={code} busy={busy} onChange={setCode} /><Button type="button" onPress={() => void send()} isDisabled={busy || cooldown.seconds > 0}>{cooldown.seconds > 0 ? `${cooldown.seconds}s 后重发` : '获取验证码'}</Button></div></label>
    <label className="authfield">新密码<input ref={passwordInput} type="password" onChange={(event) => password.set(event.currentTarget.value)} autoComplete="new-password" placeholder={`新密码（${bootstrap.password.minimumLength}–${bootstrap.password.maximumLength} 位）`} className="authinput" disabled={busy} /></label>
    <label className="authfield">确认新密码<input ref={confirmInput} type="password" onChange={(event) => confirm.set(event.currentTarget.value)} autoComplete="new-password" placeholder="确认新密码" className="authinput" disabled={busy} /></label>
    <Button type="submit" tone="primary" isDisabled={busy || !challenge}>重置密码并下线全部设备</Button>
  </form></Dialog>;
}

function strong(value: string, policy: Bootstrap['password']): boolean {
  return value.length >= policy.minimumLength && value.length <= policy.maximumLength && (!policy.uppercase || /[A-Z]/.test(value)) && (!policy.lowercase || /[a-z]/.test(value)) && (!policy.number || /\d/.test(value)) && (!policy.symbol || /[^A-Za-z0-9]/.test(value));
}
