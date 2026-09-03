import { ArrowRight, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { useCooldown } from '../../challenge/ui/useCooldown';
import { CodeField } from '../../challenge/ui/CodeField';
import type { ActionResult } from '../../../shared/ui/ActionResult';

export function OtpForm({
  busy,
  error,
  onChallenge,
  onSubmit,
}: Readonly<{
  busy: boolean;
  error: Readonly<Record<string, string>>;
  onChallenge: (subject: string) => Promise<ActionResult<Readonly<{ id: string; resendSeconds: number }>>>;
  onSubmit: (subject: string, challenge: string, code: string) => void;
}>) {
  const [subject, setSubject] = useState('');
  const [challenge, setChallenge] = useState('');
  const [challengeSubject, setChallengeSubject] = useState('');
  const [code, setCode] = useState('');
  const cooldown = useCooldown();
  const codeRef = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const [sendingCode, setSendingCode] = useState(false);
  const send = async () => {
    if (sending.current || busy || cooldown.seconds > 0) return;
    sending.current = true;
    setSendingCode(true);
    try {
      const result = await onChallenge(subject);
      if (!result.ok) return;
      setChallenge(result.value.id);
      setChallengeSubject(subject.trim());
      setCode('');
      cooldown.start(result.value.resendSeconds);
      requestAnimationFrame(() => codeRef.current?.focus());
    } finally {
      sending.current = false;
      setSendingCode(false);
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const submitted = code;
        setCode('');
        onSubmit(subject, challengeSubject === subject.trim() ? challenge : '', submitted);
      }}
      className="authform"
    >
      <label className="authfield">
        <span className="authlabel">
          <Smartphone aria-hidden="true" />
          登录账号或已绑定手机号
        </span>
        <input
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            setChallenge('');
            setCode('');
            cooldown.clear();
          }}
          autoComplete="username"
          placeholder="输入登录账号或已绑定手机号"
          className="authinput"
          disabled={busy}
          aria-invalid={error.subject ? true : undefined}
        />
        {error.subject && <span className="authfieldissue">{error.subject}</span>}
      </label>
      <label className="authfield">
        <span className="authlabel">
          <Lock aria-hidden="true" />
          短信验证码
        </span>
        <span className="authcodegroup">
          <CodeField inputRef={codeRef} value={code} busy={busy} onChange={setCode} />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || sendingCode || cooldown.seconds > 0}
            className="authcodebutton"
          >
            {sendingCode ? '发送中…' : cooldown.seconds > 0 ? `${cooldown.seconds}s 后重发` : '获取验证码'}
          </button>
        </span>
        {error.code && <span className="authfieldissue">{error.code}</span>}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="authprimary"
      >
        {busy ? <RefreshCw className="authspin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {busy ? '验证中...' : '登录'}
      </button>
    </form>
  );
}
