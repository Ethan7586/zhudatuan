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
  const receipt = mutation.data;
  const tenantScopes = context.scopes.filter((scope) => scope.kind === 'tenant' && scope.id === 'tenant-zhudatuan');
  const canSelectSenior = context.session.governance?.level === 'owner' && context.session.governance.exactOwner;

  const resetAndClose = () => {
    mutation.reset();
    setValidationError(undefined);
    setCopyState('idle');
    onClose();
  };

  const requestClose = () => {
    if (mutation.isPending || receipt !== undefined) return;
    resetAndClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    setCopyState('idle');
    const form = new FormData(event.currentTarget);
    const draft = MemberInvitationDraftSchema.safeParse({
      label: form.get('label'),
      destination: form.get('destination'),
      governanceLevel: form.get('governanceLevel'),
      maxUses: form.get('maxUses'),
      validityDays: form.get('validityDays'),
      ...(context.scope.kind === 'platform' ? { tenantId: form.get('tenantId') } : {}),
    });
    if (!draft.success) {
      setValidationError('请检查目标租户、受邀手机号、邀请名称与有效期。');
      return;
    }
    mutation.mutate(draft.data);
  };

  const copy = async () => {
    const code = receipt?.code;
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
    <Dialog open={open} title={receipt === undefined ? '生成管理员邀请码' : '邀请码已生成'} eyebrow="CONSOLE ADMINISTRATOR INVITATION" dismissable={!mutation.isPending && receipt === undefined} onClose={requestClose}>
      {receipt === undefined ? (
        <Form className={`command memberinvitationform${mutation.isPending ? ' memberinvitationformpending' : ''}`} label="生成管理员邀请码" onSubmit={submit}>
          <div className="memberinvitationbody">
            <div className="memberinvitationgrid">
              <section className="memberinvitationintro">
                <p className="commandhint">
                  <span className="memberinvitationhinticon" aria-hidden="true">
                    i
                  </span>
                  <span>{canSelectSenior
                    ? '请选择管理员级别并绑定受邀手机号。普通管理员注册后等待授权；高级管理员获得当前范围的全部业务功能，但不能任命同级或管理 Owner。'
                    : '邀请固定创建待授权普通管理员并绑定受邀手机号，仅可使用一次。受邀人完成手机验证后会同时获得购物身份与零业务权限的 Console 身份。'}</span>
                </p>
                {context.scope.kind === 'platform' ? (
                  <label>
                    目标租户
                    <select name="tenantId" defaultValue="" required autoFocus>
                      <option value="" disabled>
                        请选择目标租户
                      </option>
                      {tenantScopes.map((scope) => (
                        <option key={scope.id} value={scope.id}>
                          {scope.name ?? scope.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="memberinvitationtarget">
                    授权范围：<strong>{context.scope.name ?? context.scope.id}</strong>
                  </p>
                )}
                {canSelectSenior ? (
                  <fieldset className="memberinvitationlevels">
                    <legend>管理员级别</legend>
                    <div>
                      <label>
                        <input name="governanceLevel" type="radio" value="administrator" defaultChecked />
                        <span><strong>普通管理员</strong><small>注册后等待分配身份、权限与范围</small></span>
                      </label>
                      <label>
                        <input name="governanceLevel" type="radio" value="senior_administrator" />
                        <span><strong>高级管理员</strong><small>全部业务功能，不可任命同级或管理 Owner</small></span>
                      </label>
                    </div>
                  </fieldset>
                ) : <input name="governanceLevel" type="hidden" value="administrator" />}
              </section>
              <section className="memberinvitationdetails">
                <label>
                  受邀管理员手机号
                  <input name="destination" type="tel" inputMode="tel" pattern="1[3-9][0-9]{9}" placeholder="请输入 11 位手机号" required />
                </label>
                <label>
                  邀请名称
                  <input name="label" defaultValue="管理员邀请" minLength={2} maxLength={80} required autoFocus={context.scope.kind !== 'platform'} />
                </label>
                <section className="memberinvitationpolicy" aria-label="邀请规则">
                  <p>邀请规则</p>
                  <div>
                    <span>可使用次数</span>
                    <strong>1 次</strong>
                    <input name="maxUses" type="hidden" value="1" />
                  </div>
                  <label>
                    <span>有效期</span>
                    <select name="validityDays" defaultValue="7">
                      <option value="1">1 天</option>
                      <option value="3">3 天</option>
                      <option value="7">7 天</option>
                      <option value="30">30 天</option>
                      <option value="90">90 天</option>
                    </select>
                  </label>
                </section>
                {validationError === undefined && mutation.error === null ? null : (
                  <p className="memberinvitationerror" role="alert">
                    {validationError ?? '邀请码生成失败。请确认当前范围、权限与登录状态后重试。'}
                  </p>
                )}
              </section>
            </div>
          </div>
          <footer>
            <p className="memberinvitationfootnote">生成后邀请码仅显示一次，请及时复制保存。</p>
            <div className="memberinvitationactions">
              <Button onPress={requestClose} isDisabled={mutation.isPending}>
                取消
              </Button>
              <Button type="submit" tone="primary" isPending={mutation.isPending}>
                {mutation.isPending ? '正在生成…' : '生成邀请码'}
              </Button>
            </div>
          </footer>
        </Form>
      ) : (
        <section className="memberinvitationreceipt" aria-live="polite">
          <p className="notice">邀请码只在本次成功回执中显示。关闭后无法再次查看，请现在复制并通过可信渠道发送。</p>
          <button
            type="button"
            className="memberinvitationcode"
            data-copy-state={copyState}
            aria-label={copyState === 'copied' ? '管理员邀请码已复制' : '复制管理员邀请码'}
            onClick={() => {
              void copy();
            }}
          >
            <span>管理员邀请码</span>
            <code>{receipt.code}</code>
            <small>{copyState === 'copied' ? '✓ 已复制' : '点击邀请码即可复制'}</small>
          </button>
          <dl>
            <div>
              <dt>身份</dt>
              <dd>{receipt.governanceLevel === 'senior_administrator' ? '高级管理员' : '待授权普通管理员'}</dd>
            </div>
            <div>
              <dt>次数</dt>
              <dd>{receipt.max_uses} 次</dd>
            </div>
            <div>
              <dt>到期</dt>
              <dd>{new Date(receipt.expires_at).toLocaleString('zh-CN')}</dd>
            </div>
          </dl>
          {copyState === 'idle' ? null : <p role="status">{copyState === 'copied' ? '已复制到剪贴板。' : '无法访问剪贴板，请手动复制。'}</p>}
          <footer>
            <Button
              onPress={() => {
                void copy();
              }}
            >
              {copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败，重试' : '复制邀请码'}
            </Button>
            <Button tone="primary" onPress={resetAndClose}>
              我已保存，关闭
            </Button>
          </footer>
        </section>
      )}
    </Dialog>
  );
}
