import { Button, Dialog } from '@shop/design';
import type { MemberViewModel } from '../viewmodel/MemberViewModel';

export function RegistrationResetDialog({ model }: Readonly<{ model: MemberViewModel }>) {
  const editor = model.registrationEditor;
  if (editor === undefined) return null;
  const receipt = model.registrationReceipt;
  return (
    <Dialog
      open
      title={receipt === undefined ? '重置注册身份' : '注册身份已重置'}
      eyebrow="仅限唯一所有者 · 高风险操作"
      dismissable={!model.registration.busy}
      onClose={model.actions.closeRegistration}
    >
      {receipt === undefined ? (
        <form
          className="memberform registrationresetform"
          aria-label="重置注册身份"
          onSubmit={(event) => {
            event.preventDefault();
            model.actions.submitRegistration();
          }}
        >
          <section className="registrationresetimpact" aria-labelledby="registrationresetimpacttitle">
            <strong id="registrationresetimpacttitle">这不是删除成员或业务资料</strong>
            <p>系统会停用“{editor.member.displayName}”的商城端和管理端登录身份，立即撤销其全部会话，并释放原登录手机号。</p>
            <ul>
              <li>原登录身份将无法继续进入任何工作区。</li>
              <li>订单、卡券、资金记录与安全审计会完整保留。</li>
              <li>如需恢复后台访问，必须创建新邀请并由该成员重新注册。</li>
            </ul>
          </section>
          <label>
            操作原因
            <textarea value={editor.reason} minLength={4} maxLength={500} rows={3} onChange={(event) => model.actions.registrationReason(event.target.value)} required />
          </label>
          <label className="registrationresetacknowledgement">
            <input type="checkbox" checked={editor.understood} onChange={(event) => model.actions.registrationUnderstood(event.target.checked)} required />
            <span>我理解身份重置不可撤销，且历史业务记录不会被删除。</span>
          </label>
          <label>
            输入“重置”确认
            <input value={editor.confirmation} autoComplete="off" onChange={(event) => model.actions.registrationConfirmation(event.target.value)} required />
          </label>
          <label>
            当前所有者密码
            <input value={editor.ownerPassword} type="password" autoComplete="current-password" maxLength={128} onChange={(event) => model.actions.registrationPassword(event.target.value)} required />
          </label>
          <p className="membersecurity">密码仅发送到独立验证接口；身份重置请求不会携带或保存密码。服务端会再次检查所有者身份、目标保护状态和最新版本。</p>
          {model.assurance < 2 ? (
            <Button tone="primary" onPress={model.actions.stepup}>
              先完成二次身份验证
            </Button>
          ) : null}
          {model.registration.error ? (
            <p className="membererror" role="alert">
              {model.registration.error}
            </p>
          ) : null}
          {model.registrationValidation ? <p className="membervalidation">{model.registrationValidation}</p> : null}
          <footer>
            <Button onPress={model.actions.closeRegistration} isDisabled={model.registration.busy}>
              取消
            </Button>
            <Button type="submit" tone="danger" isDisabled={model.registration.busy || model.registrationValidation !== undefined}>
              {model.registration.busy ? '正在验证并重置…' : '验证密码并重置'}
            </Button>
          </footer>
        </form>
      ) : (
        <section className="registrationresetreceipt" aria-live="polite">
          <div>
            <strong>原登录手机号已释放</strong>
            <p>该成员的旧会话和登录凭据已失效；订单、卡券、资金记录与安全审计仍然保留。</p>
            <small>已处理 {receipt.memberships.length} 个成员身份 · 最新权限版本第 {receipt.accessVersion} 版</small>
          </div>
          <footer>
            <Button onPress={model.actions.closeRegistration}>关闭</Button>
            {model.canInvite ? <Button tone="primary" onPress={model.actions.inviteAfterReset}>创建新的管理员邀请</Button> : null}
          </footer>
        </section>
      )}
    </Dialog>
  );
}
