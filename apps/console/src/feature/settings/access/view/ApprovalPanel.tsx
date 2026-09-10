import { Button } from '@shop/design';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';

export function ApprovalPanel({ model, destructive = false }: Readonly<{ model: AccessViewModel; destructive?: boolean }>) {
  const editor = model.editor;
  if (editor === undefined) return null;
  return (
    <>
      <section className="accessapproval" aria-label="双人复核">
        <strong>高强度验证与双人复核</strong>
        <p>{model.editor?.kind === 'owner' ? ownerApprovalText(model.editor.action) : '生成的请求码会绑定本次操作、目标和最新授权状态，必须由另一位拥有相同管理权限的管理员签发一次性凭证。'}</p>
        {model.approval.error ? (
          <p className="accesserror" role="alert">
            {model.approval.error}
          </p>
        ) : null}
        {model.editor && model.validation === '请先完成高强度二次验证。' ? (
          <Button onPress={model.actions.stepup} tone="primary">
            立即完成二次验证
          </Button>
        ) : (
          <Button onPress={model.actions.prepare} isDisabled={model.approval.busy}>
            {model.approval.busy ? '正在生成…' : '生成复核请求码'}
          </Button>
        )}
        {model.approval.request ? (
          <label>
            复核请求码
            <textarea value={model.approval.request} readOnly />
            <Button onPress={() => void navigator.clipboard.writeText(model.approval.request)}>复制请求码</Button>
          </label>
        ) : null}
        <label>
          一次性复核凭证
          <input value={editor.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.proof(event.target.value)} placeholder="粘贴另一位管理员签发的复核凭证" />
        </label>
        <label className="accessconfirm">
          <input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
          {destructive && model.editor?.kind === 'owner' ? ownerConfirmationText(model.editor.action) : destructive ? '我已核对不可逆影响' : '我已核对目标和修改内容'}
        </label>
      </section>
      {model.conflict ? (
        <section className="accessconflict" role="alert" aria-label="并发修改冲突">
          <strong>{model.conflict.title}</strong>
          <p>系统已读取最新权威状态，没有覆盖其他管理员的修改。请核对下列差异：</p>
          <ul>
            {model.conflict.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <Button onPress={model.actions.resolveConflict}>{model.conflict.next ? '应用最新基线并重新复核' : '关闭并重新选择目标'}</Button>
        </section>
      ) : null}
      {model.mutation.error ? (
        <p className="accesserror" role="alert">
          {model.mutation.error}
        </p>
      ) : null}
      {model.validation ? <p className="accessvalidation">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.actions.close} isDisabled={model.mutation.busy}>
          取消
        </Button>
        <Button type="submit" tone={destructive ? 'danger' : 'primary'} isDisabled={model.mutation.busy || model.validation !== undefined}>
          {model.mutation.busy ? '正在执行…' : model.editor?.kind === 'owner' ? ownerSubmitText(model.editor.action) : '确认执行'}
        </Button>
      </footer>
    </>
  );
}

function ownerApprovalText(action: 'create' | 'accept' | 'cancel'): string {
  if (action === 'create') return '请求码绑定新所有者、双方最新授权状态、原所有者后续角色和原因；复核通过后只会发起待接受申请。';
  if (action === 'accept') return '目标账号必须使用自己的会话接受，并提供不同于发起方的独立一次性凭证；成功后所有权才会原子切换。';
  return '仅原所有者可以取消待接受申请；取消请求仍需绑定当前申请状态并由另一位管理员复核。';
}

function ownerConfirmationText(action: 'create' | 'accept' | 'cancel'): string {
  if (action === 'create') return '我已核对目标账号、后续角色和影响范围';
  if (action === 'accept') return '我已核对申请来源，并确认接受后立即切换所有权';
  return '我已核对申请状态，并确认取消后不能再接受';
}

function ownerSubmitText(action: 'create' | 'accept' | 'cancel'): string {
  if (action === 'create') return '确认发起申请';
  if (action === 'accept') return '确认接受所有权';
  return '确认取消申请';
}
