import { Button, Dialog, Form } from '@shop/design';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { resetMemberRegistration } from './MemberRegistrationResetCommand';
import { MemberRegistrationResetDraftSchema, type MemberRegistrationResetReceipt } from './MemberRegistrationResetSchema';
import type { Member } from './MemberSchema';
import './MemberRegistrationReset.css';

export function MemberRegistrationResetDialog({
  context,
  target,
  onClose,
  onReset,
  onInvite,
}: Readonly<{
  context: ConsoleContext;
  target: Member | undefined;
  onClose: () => void;
  onReset: () => void;
  onInvite?: () => void;
}>) {
  const [pending, setPending] = useState(false);
  const [validationError, setValidationError] = useState<string>();
  const [commandError, setCommandError] = useState(false);
  const [receipt, setReceipt] = useState<MemberRegistrationResetReceipt>();

  const close = () => {
    if (pending) return;
    setValidationError(undefined);
    setCommandError(false);
    setReceipt(undefined);
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (target === undefined || pending) return;
    setValidationError(undefined);
    setCommandError(false);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const draft = MemberRegistrationResetDraftSchema.safeParse({
      reason: formData.get('reason'),
      understood: formData.get('understood'),
      confirmation: formData.get('confirmation'),
      ownerPassword: formData.get('ownerPassword'),
    });
    if (!draft.success) {
      setValidationError('请填写操作原因、确认影响、输入“重置”，并验证当前 Owner 密码。');
      return;
    }
    setPending(true);
    void resetMemberRegistration(context, target, draft.data)
      .then((value) => {
        form.reset();
        setReceipt(value);
        onReset();
      })
      .catch(() => setCommandError(true))
      .finally(() => setPending(false));
  };

  const invite = () => {
    if (onInvite === undefined) return;
    close();
    onInvite();
  };

  return (
    <Dialog
      open={target !== undefined}
      title={receipt === undefined ? '重置注册身份' : '注册身份已重置'}
      eyebrow="OWNER-ONLY IDENTITY RESET"
      dismissable={!pending}
      onClose={close}
    >
      {target === undefined ? null : receipt === undefined ? (
        <Form className="command memberresetform" label="重置注册身份" onSubmit={submit}>
          <section className="memberresetimpact" aria-labelledby="memberresetimpacttitle">
            <strong id="memberresetimpacttitle">这不是物理删除会员资料</strong>
            <p>
              将停用“{target.display_name}”的登录身份，立即注销其购物端与后台会话，并释放原登录手机号供重新注册。
            </p>
            <ul>
              <li>购物身份与后台身份都会停止使用。</li>
              <li>订单、卡券、财务记录与安全审计会继续保留。</li>
              <li>完成后需要生成新的管理员邀请码，才能再次注册后台。</li>
            </ul>
          </section>
          <label>
            操作原因
            <textarea name="reason" minLength={4} maxLength={500} rows={3} required />
          </label>
          <label className="memberresetacknowledgement">
            <input name="understood" type="checkbox" required />
            <span>我理解这是不可撤销的身份重置，历史业务记录不会被删除。</span>
          </label>
          <label>
            输入“重置”确认
            <input name="confirmation" autoComplete="off" required />
          </label>
          <label>
            当前 Owner 密码
            <input name="ownerPassword" type="password" autoComplete="current-password" maxLength={128} required />
          </label>
          {validationError === undefined && !commandError ? null : (
            <p className="memberreseterror" role="alert">
              {validationError ?? 'Owner 密码验证或身份重置失败。请刷新成员资料后重试。'}
            </p>
          )}
          <footer>
            <Button onPress={close} isDisabled={pending}>
              取消
            </Button>
            <Button type="submit" tone="danger" isPending={pending}>
              {pending ? '正在验证并重置…' : '验证密码并重置'}
            </Button>
          </footer>
        </Form>
      ) : (
        <section className="memberresetreceipt" aria-live="polite">
          <div>
            <strong>原登录手机号已释放</strong>
            <p>此手机号现在可以使用新的管理员邀请码重新注册。原订单、卡券、财务记录与安全审计仍然保留。</p>
          </div>
          <footer>
            <Button onPress={close}>关闭</Button>
            {onInvite === undefined ? null : (
              <Button tone="primary" onPress={invite}>
                生成新的管理员邀请码
              </Button>
            )}
          </footer>
        </section>
      )}
    </Dialog>
  );
}
