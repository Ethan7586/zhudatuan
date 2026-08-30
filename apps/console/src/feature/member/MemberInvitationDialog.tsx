import { Button, Dialog, Form } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { createMemberInvitation } from './MemberInvitationCommand';
import { MemberInvitationDraftSchema } from './MemberInvitationSchema';
import './MemberInvitation.css';

export function MemberInvitationDialog({
  context,
  open,
  onClose,
}: Readonly<{
  context: ConsoleContext;
  open: boolean;
  onClose: () => void;
}>) {
  const [validationError, setValidationError] = useState<string>();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const mutation = useMutation({ mutationFn: (draft: Parameters<typeof createMemberInvitation>[1]) => createMemberInvitation(context, draft) });

  const close = () => {
    if (mutation.isPending) return;
    mutation.reset();
    setValidationError(undefined);
    setCopyState('idle');
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    setCopyState('idle');
    const form = new FormData(event.currentTarget);
    const draft = MemberInvitationDraftSchema.safeParse({
      label: form.get('label'),
      maxUses: form.get('maxUses'),
      validityDays: form.get('validityDays'),
    });
    if (!draft.success) {
      setValidationError('请检查邀请名称、使用次数与有效期。');
      return;
    }
    mutation.mutate(draft.data);
  };

  const copy = async () => {
    const code = mutation.data?.code;
    if (code === undefined || navigator.clipboard === undefined) {
      setCopyState('failed');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <Dialog open={open} title={mutation.data === undefined ? '生成管理员邀请码' : '邀请码已生成'} eyebrow="ZERO-PERMISSION CONSOLE INVITATION" dismissable={!mutation.isPending} onClose={close}>
      {mutation.data === undefined ? (
        <Form className="command memberinvitationform" label="生成管理员邀请码" onSubmit={submit}>
          <p className="commandhint">邀请固定创建待授权普通管理员，不可在发码时选择角色。受邀人完成手机验证后会同时获得购物身份与零业务权限的 Console 身份。</p>
          <p className="memberinvitationtarget">
            授权范围：<strong>{context.scope.name ?? context.scope.id}</strong>
          </p>
          <label>
            邀请名称
            <input name="label" defaultValue="普通管理员邀请" minLength={2} maxLength={80} required autoFocus />
          </label>
          <div className="fieldgrid">
            <label>
              可使用次数
              <input name="maxUses" type="number" defaultValue="1" min="1" max="500" inputMode="numeric" required />
            </label>
            <label>
              有效期
              <select name="validityDays" defaultValue="7">
                <option value="1">1 天</option>
                <option value="3">3 天</option>
                <option value="7">7 天</option>
                <option value="30">30 天</option>
                <option value="90">90 天</option>
              </select>
            </label>
          </div>
          {validationError === undefined && mutation.error === null ? null : (
            <p className="memberinvitationerror" role="alert">
              {validationError ?? '邀请码生成失败。请确认当前范围、权限与登录状态后重试。'}
            </p>
          )}
          <footer>
            <Button onPress={close} isDisabled={mutation.isPending}>
              取消
            </Button>
            <Button type="submit" tone="primary" isPending={mutation.isPending}>
              {mutation.isPending ? '正在生成…' : '生成邀请码'}
            </Button>
          </footer>
        </Form>
      ) : (
        <section className="memberinvitationreceipt" aria-live="polite">
          <p className="notice">邀请码只在本次成功回执中显示。关闭后无法再次查看，请现在复制并通过可信渠道发送。</p>
          <div>
            <span>管理员邀请码</span>
            <code>{mutation.data.code}</code>
          </div>
          <dl>
            <div>
              <dt>身份</dt>
              <dd>待授权普通管理员</dd>
            </div>
            <div>
              <dt>次数</dt>
              <dd>{mutation.data.max_uses} 次</dd>
            </div>
            <div>
              <dt>到期</dt>
              <dd>{new Date(mutation.data.expires_at).toLocaleString('zh-CN')}</dd>
            </div>
          </dl>
          {copyState === 'idle' ? null : <p role="status">{copyState === 'copied' ? '已复制到剪贴板。' : '无法访问剪贴板，请手动复制。'}</p>}
          <footer>
            <Button
              onPress={() => {
                void copy();
              }}
            >
              复制邀请码
            </Button>
            <Button tone="primary" onPress={close}>
              我已保存，关闭
            </Button>
          </footer>
        </section>
      )}
    </Dialog>
  );
}
