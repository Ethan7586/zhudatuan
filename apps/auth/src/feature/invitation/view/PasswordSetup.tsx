import type { RefObject } from 'react';
import type { PasswordPolicy } from '../../bootstrap/model/Bootstrap';

export function PasswordSetup({ policy, passwordRef, confirmRef, busy, onPassword, onConfirm }: Readonly<{ policy: PasswordPolicy; passwordRef: RefObject<HTMLInputElement | null>; confirmRef: RefObject<HTMLInputElement | null>; busy: boolean; onPassword: (value: string) => void; onConfirm: (value: string) => void }>) {
  return (
    <section className="enrollmentpassword" aria-labelledby="passwordTitle">
      <div><span>第三步</span><h4 id="passwordTitle">设置登录密码</h4></div>
      <div className="enrollmentfields">
        <label htmlFor="enrollmentPassword">设置密码<input ref={passwordRef} id="enrollmentPassword" type="password" onChange={(event) => onPassword(event.currentTarget.value)} autoComplete="new-password" placeholder={`${policy.minimumLength}–${policy.maximumLength} 位，按安全要求组合字符`} disabled={busy} required /></label>
        <label htmlFor="enrollmentConfirm">确认密码<input ref={confirmRef} id="enrollmentConfirm" type="password" onChange={(event) => onConfirm(event.currentTarget.value)} autoComplete="new-password" placeholder="再次输入密码" disabled={busy} required /></label>
      </div>
    </section>
  );
}
