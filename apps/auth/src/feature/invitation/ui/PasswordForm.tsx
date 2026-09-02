export function PasswordForm({ password, confirm, busy, onPassword, onConfirm }: Readonly<{ password: string; confirm: string; busy: boolean; onPassword: (value: string) => void; onConfirm: (value: string) => void }>) {
  return (
    <section className="enrollmentpassword" aria-labelledby="passwordTitle">
      <div><span>第三步</span><h4 id="passwordTitle">设置登录密码</h4></div>
      <div className="enrollmentfields">
        <label htmlFor="enrollmentPassword">设置密码<input id="enrollmentPassword" type="password" value={password} onChange={(event) => onPassword(event.target.value)} autoComplete="new-password" placeholder="12–128 位，包含大小写、数字和符号" disabled={busy} required /></label>
        <label htmlFor="enrollmentConfirm">确认密码<input id="enrollmentConfirm" type="password" value={confirm} onChange={(event) => onConfirm(event.target.value)} autoComplete="new-password" placeholder="再次输入密码" disabled={busy} required /></label>
      </div>
    </section>
  );
}
