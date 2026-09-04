import { Button } from '@shop/design';
import { useInvitationProof } from '../viewmodel/InvitationViewModel';
import type { LoginProofMethod } from '../../login';
import { ChallengeStatus, type Challenge } from '../../challenge';

export function InvitationProof({ busy, method, challenge, onSubmit }: Readonly<{ busy: boolean; method: LoginProofMethod; challenge?: Challenge; onSubmit: (code: string) => Promise<void> }>) {
  const vm = useInvitationProof(onSubmit);
  if (method === 'sso') return <p className="enrollmentnotice">正在跳转到企业身份提供方完成验证…</p>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await vm.submit();
  };
  return (
    <form aria-label="邀请码安全验证" className="invitationproofform" onSubmit={(event) => void submit(event)}>
      <label className="authfield" htmlFor="invitationProof">短信验证码</label>
      {challenge ? <ChallengeStatus challenge={challenge} /> : null}
      <input
        className="authinput"
        ref={vm.input}
        id="invitationProof"
        onChange={(event) => vm.setCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="输入 6 位验证码"
        disabled={busy}
      />
      <Button className="authfull" tone="primary" type="submit" isDisabled={busy}>
        {busy ? '验证中…' : '完成安全验证'}
      </Button>
    </form>
  );
}
