import { Button, Dialog, Form } from '@shop/design';
import { PolicyDialog } from '../../../shared/ui/PolicyDialog';
import { canEditDisplayName } from '../model/RegistrationPolicy';
import type { EnrollmentViewModel } from '../viewmodel/EnrollmentViewModel';
import { EnrollmentError } from './EnrollmentError';
import { MobileProof } from './MobileProof';
import { PasswordSetup } from './PasswordSetup';

export function EnrollmentPage({ viewmodel }: Readonly<{ viewmodel: EnrollmentViewModel }>) {
  const vm = viewmodel;
  return (
    <>
      <Dialog open title="注册员工商城账号" eyebrow="员工邀请" onClose={vm.close} dismissable={vm.busy === undefined}>
        <Form
          label="员工注册"
          className="enrollmentform"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit();
          }}
        >
          <header className="enrollmentintro">
            <div>
              <span>第一步</span>
              <h3>{vm.enrollment.organization.name}</h3>
            </div>
            <p>验证邀请绑定的手机号，设置密码后即可进入员工商城。</p>
            <dl>
              <div>
                <dt>邀请类型</dt>
                <dd>{vm.bound ? '指定员工邀请' : '共享注册邀请'}</dd>
              </div>
              <div>
                <dt>有效期至</dt>
                <dd>{format(vm.enrollment.expiresAt)}</dd>
              </div>
              {vm.enrollment.employee?.employeeNo ? (
                <div>
                  <dt>员工编号</dt>
                  <dd>{vm.enrollment.employee.employeeNo}</dd>
                </div>
              ) : null}
            </dl>
          </header>
          {vm.error ? <EnrollmentError message={vm.error} /> : null}
          {vm.notice ? (
            <p className="enrollmentnotice" role="status">
              {vm.notice}
            </p>
          ) : null}
          <label className="authfield" htmlFor="enrollmentName">
            姓名
            <input
              className="authinput"
              ref={vm.first}
              id="enrollmentName"
              value={vm.form.displayName}
              onChange={(event) => vm.update('displayName', event.target.value)}
              maxLength={80}
              autoComplete="name"
              readOnly={!canEditDisplayName(vm.enrollment.subjectMode)}
              disabled={vm.busy !== undefined}
            />
          </label>
          {!canEditDisplayName(vm.enrollment.subjectMode) ? <small className="enrollmenthint">姓名来自员工邀请，如需修改请联系管理员。</small> : null}
          <MobileProof
            bound={vm.bound}
            {...(vm.enrollment.recipientMasked === undefined ? {} : { masked: vm.enrollment.recipientMasked })}
            mobile={vm.form.mobile}
            code={vm.form.code}
            {...(vm.challenge === undefined ? {} : { challenge: vm.challenge })}
            busy={vm.busy !== undefined}
            seconds={vm.seconds}
            onMobile={(value) => vm.update('mobile', value)}
            onCode={(value) => vm.update('code', value)}
            onSend={() => void vm.send()}
          />
          <PasswordSetup policy={vm.passwordPolicy} passwordRef={vm.passwordInput} confirmRef={vm.confirmInput} busy={vm.busy !== undefined} onPassword={vm.setPassword} onConfirm={vm.setConfirm} />
          <label className="enrollmentagreement">
            <input type="checkbox" checked={vm.accepted} onChange={(event) => vm.setAccepted(event.target.checked)} disabled={vm.busy !== undefined} />
            <span>
              我已阅读并同意{' '}
              <Button tone="quiet" className="authinline" onPress={() => vm.setPolicy('terms')}>
                《{vm.enrollment.policy.termsTitle}》
              </Button>
              和
              <Button tone="quiet" className="authinline" onPress={() => vm.setPolicy('privacy')}>
                《{vm.enrollment.policy.privacyTitle}》
              </Button>
            </span>
          </label>
          <Button type="submit" tone="primary" isDisabled={vm.busy !== undefined || vm.challenge === undefined || !vm.accepted}>
            {vm.busy === 'submit' ? '正在创建账号…' : '创建普通员工账号'}
          </Button>
          <p className="enrollmenthint">密码和验证码不会写入浏览器长期存储。注册仅开通员工商城，控制台权限需另行授权；管理员全程看不到初始密码。</p>
        </Form>
      </Dialog>
      <PolicyDialog
        policy={vm.enrollment.policy}
        {...(vm.policy === undefined ? {} : { kind: vm.policy })}
        onClose={() => vm.setPolicy(undefined)}
        onAccept={() => {
          vm.setAccepted(true);
          vm.setPolicy(undefined);
        }}
      />
    </>
  );
}

function format(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
