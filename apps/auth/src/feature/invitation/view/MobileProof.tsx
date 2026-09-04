import { Button } from '@shop/design';

export function MobileProof({
  bound,
  masked,
  mobile,
  code,
  challengeReady,
  busy,
  seconds,
  onMobile,
  onCode,
  onSend,
}: Readonly<{
  bound: boolean;
  masked?: string;
  mobile: string;
  code: string;
  challengeReady: boolean;
  busy: boolean;
  seconds: number;
  onMobile: (value: string) => void;
  onCode: (value: string) => void;
  onSend: () => void;
}>) {
  return (
    <section className="enrollmentproof" aria-labelledby="mobileProofTitle">
      <div>
        <span>第二步</span>
        <h4 id="mobileProofTitle">验证绑定手机号</h4>
      </div>
      {bound ? (
        <div className="enrollmentreadonly">
          <span>邀请绑定手机号</span>
          <strong>{masked ?? '已安全绑定'}</strong>
          <small>手机号由邀请记录确定，无法在此修改。</small>
        </div>
      ) : (
        <label htmlFor="enrollmentMobile">
          登录手机号
          <input id="enrollmentMobile" value={mobile} onChange={(event) => onMobile(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="用于登录、验证与找回密码" disabled={busy} required />
        </label>
      )}
      <label htmlFor="enrollmentCode">手机验证码</label>
      <div className="enrollmentcode">
        <input
          id="enrollmentCode"
          value={code}
          onChange={(event) => onCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 位验证码"
          disabled={busy}
          required
        />
        <Button onPress={onSend} isDisabled={busy || seconds > 0}>
          {seconds > 0 ? `${seconds}s 后重发` : challengeReady ? '重新发送' : '获取验证码'}
        </Button>
      </div>
    </section>
  );
}
