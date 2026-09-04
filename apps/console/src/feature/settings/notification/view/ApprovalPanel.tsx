import { Button } from '@shop/design';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';

export function ApprovalPanel({ model }: Readonly<{ model: NotificationViewModel }>) {
  const editor = model.editor;
  if (!editor || !model.reviewing) return null;
  return (
    <section className="notificationapproval" aria-label="发布审批">
      <strong>高强度验证与双人复核</strong>
      <p>复核请求会绑定操作、目标、完整内容和服务端版本。另一位具备同一权限的管理员签发一次性凭证后才能提交。</p>
      {model.assurance < 3 ? (
        <Button tone="primary" onPress={model.actions.stepup}>
          完成高强度二次验证
        </Button>
      ) : (
        <Button onPress={model.actions.prepare}>{model.approval.request ? '重新生成复核请求码' : '生成复核请求码'}</Button>
      )}
      {model.approval.request ? (
        <label>
          复核请求码
          <textarea value={model.approval.request} readOnly />
          <Button onPress={() => void navigator.clipboard.writeText(model.approval.request ?? '')}>复制请求码</Button>
        </label>
      ) : null}
      <label>
        一次性复核凭证
        <input value={editor.proof} onChange={(event) => model.actions.proof(event.target.value)} autoComplete="off" spellCheck={false} placeholder="粘贴另一位管理员签发的凭证" />
      </label>
      <label className="notificationconfirm">
        <input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        <span>我已核对渠道、受众、时间、变量和最终预览内容</span>
      </label>
      {model.approval.error ? (
        <p className="notificationerror" role="alert">
          {model.approval.error}
        </p>
      ) : null}
    </section>
  );
}
