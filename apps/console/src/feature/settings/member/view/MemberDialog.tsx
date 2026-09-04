import { Button, Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { MemberViewModel } from '../viewmodel/MemberViewModel';

export function MemberDialog({ model }: Readonly<{ model: MemberViewModel }>) {
  const editor = model.editor;
  if (editor === undefined) return null;
  return (
    <Dialog open title="编辑成员" eyebrow="成员资料 · 服务端状态 · 版本校验" onClose={model.actions.close} dismissable={!model.manage.busy}>
      <form
        className="memberform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <section className="membertarget" aria-label="当前成员">
          <strong>{editor.member.displayName}</strong>
          <span>{editor.member.employeeNo ? `员工号 ${editor.member.employeeNo}` : '未设置员工号'}</span>
          <small>
            所属范围：{chineseReference('组织范围', editor.member.organizationId)} · 当前权限版本：第 {editor.member.accessVersion} 版
          </small>
        </section>
        <fieldset>
          <legend>变更类型</legend>
          <label>
            <input type="radio" name="memberchange" checked={editor.kind === 'profile'} onChange={() => model.actions.kind('profile')} />
            成员资料
          </label>
          <label>
            <input type="radio" name="memberchange" checked={editor.kind === 'status'} onChange={() => model.actions.kind('status')} />
            成员状态
          </label>
        </fieldset>
        {editor.kind === 'profile' ? (
          <label>
            显示名称
            <input value={editor.displayName} minLength={1} maxLength={128} onChange={(event) => model.actions.displayName(event.target.value)} required />
          </label>
        ) : (
          <label>
            成员状态
            <select value={editor.status} onChange={(event) => model.actions.status(event.target.value as typeof editor.status)}>
              <option value="active">正常</option>
              <option value="suspended">暂停</option>
              <option value="left">已离开</option>
            </select>
          </label>
        )}
        <label>
          审计原因
          <textarea value={editor.reason} minLength={4} maxLength={1000} onChange={(event) => model.actions.reason(event.target.value)} required />
        </label>
        <p className="membersecurity">{model.assurance >= 2 ? '当前会话满足验证等级；提交时将校验服务端目标版本，事务提交后权威回读。' : '成员资料与状态变更需要先完成二次验证。'}</p>
        {model.assurance < 2 ? (
          <Button onPress={model.actions.stepup} tone="primary">
            立即完成二次验证
          </Button>
        ) : null}
        {model.manage.error ? (
          <p className="membererror" role="alert">
            {model.manage.error}
          </p>
        ) : null}
        {model.validation ? <p className="membervalidation">{model.validation}</p> : null}
        <footer>
          <Button onPress={model.actions.close} isDisabled={model.manage.busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={model.manage.busy || model.validation !== undefined}>
            {model.manage.busy ? '正在保存…' : '保存变更'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
