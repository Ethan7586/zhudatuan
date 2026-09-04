import { Button } from '@shop/design';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';

export function RiskApproval({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  return (
    <section className="riskapproval" aria-label="高风险操作审批">
      <strong>高强度验证与双人复核</strong>
      <p>请求码绑定操作、完整命令、目标资源和当前版本。必须由另一位具备风险管理权限的管理员核对并签发一次性凭证。</p>
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
      <label className="riskconfirm">
        <input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        <span>我已核对回放或处置预览、目标版本、影响范围和不可逆后果</span>
      </label>
      {model.approval.error ? (
        <p className="riskerror" role="alert">
          {model.approval.error}
        </p>
      ) : null}
    </section>
  );
}
