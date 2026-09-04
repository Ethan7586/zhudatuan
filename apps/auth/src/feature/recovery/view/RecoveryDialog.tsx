import { Button, Dialog } from '@shop/design';
import type { FailureView } from '@shop/presentation';
import { ChallengeStatus, CodeField } from '../../challenge';
import { Alert } from '../../../shared/ui/Alert';
import type { RecoveryViewModel } from '../viewmodel/RecoveryViewModel';

export function RecoveryDialog({ open, viewmodel, failure }: Readonly<{ open: boolean; viewmodel: RecoveryViewModel; failure?: FailureView }>) {
  const vm = viewmodel;
  return (
    <Dialog open={open} title="找回密码" eyebrow="安全验证" description="验证绑定手机号后重置密码，完成后所有旧设备立即下线。" initialFocus={vm.mobileInput} onClose={vm.close} dismissable={!vm.busy}>
      <form
        className="authdialogform"
        onSubmit={(event) => {
          event.preventDefault();
          void vm.submit();
        }}
      >
        {failure !== undefined ? <Alert failure={failure} /> : vm.failure !== undefined ? <Alert failure={vm.failure} /> : null}
        {vm.notice ? <Alert notice={vm.notice} /> : null}
        {vm.issue ? (
          <p className="authfieldissue" role="alert">
            {vm.issue}
          </p>
        ) : null}
        <label className="authfield" htmlFor="recoveryAccount">
          登录账号或已绑定手机号
          <input id="recoveryAccount" ref={vm.mobileInput} value={vm.mobile} onChange={(event) => vm.changeMobile(event.target.value)} autoComplete="username" placeholder="登录账号或已绑定手机号" className="authinput" disabled={vm.busy} />
        </label>
        <label className="authfield" htmlFor="recoveryCode">
          短信验证码
          <div className="authcodegroup">
            <CodeField id="recoveryCode" value={vm.code} busy={vm.busy} onChange={vm.setCode} />
            <Button type="button" onPress={() => void vm.send()} isDisabled={vm.busy || vm.seconds > 0}>
              {vm.seconds > 0 ? `${vm.seconds}s 后重发` : '获取验证码'}
            </Button>
          </div>
        </label>
        {vm.challenge ? <ChallengeStatus challenge={vm.challenge} /> : null}
        <label className="authfield">
          新密码
          <input
            ref={vm.passwordInput}
            type="password"
            onChange={(event) => vm.setPassword(event.currentTarget.value)}
            autoComplete="new-password"
            placeholder={`新密码（${vm.bootstrap.password.minimumLength}–${vm.bootstrap.password.maximumLength} 位）`}
            className="authinput"
            disabled={vm.busy}
          />
        </label>
        <label className="authfield">
          确认新密码
          <input ref={vm.confirmInput} type="password" onChange={(event) => vm.setConfirm(event.currentTarget.value)} autoComplete="new-password" placeholder="确认新密码" className="authinput" disabled={vm.busy} />
        </label>
        <Button type="submit" tone="primary" isDisabled={vm.busy || vm.challenge === undefined}>
          重置密码并下线全部设备
        </Button>
      </form>
    </Dialog>
  );
}
