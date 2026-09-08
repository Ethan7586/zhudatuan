import { Button } from '@shop/design';
import { ChallengeStatus } from './ChallengeStatus';
import type { Challenge, ProofMethod } from '../model/Challenge';
import { useProofForm } from '../viewmodel/ChallengeViewModel';

export function ProofForm({ busy, method, challenge, onSubmit }: Readonly<{ busy: boolean; method: ProofMethod; challenge?: Challenge; onSubmit: (code: string) => Promise<void> }>) {
  const vm = useProofForm(onSubmit);
  if (method === 'sso') return <p className="enrollmentnotice">正在跳转到企业身份提供方完成验证…</p>;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await vm.submit();
  };
  return (
    <form aria-label="身份安全验证" className="authproofform" onSubmit={(event) => void submit(event)}>
      <label className="authfield" htmlFor="identityProof">
        短信验证码
      </label>
      {challenge ? <ChallengeStatus challenge={challenge} /> : null}
      <input
        className="authinput"
        ref={vm.input}
        id="identityProof"
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
