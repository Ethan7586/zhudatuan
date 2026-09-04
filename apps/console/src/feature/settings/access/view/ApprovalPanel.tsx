import { Button } from '@shop/design';
import type { AccessViewModel } from '../viewmodel/AccessViewModel';

export function ApprovalPanel({ model, destructive = false }: Readonly<{ model: AccessViewModel; destructive?: boolean }>) {
  const editor = model.editor;
  if (editor === undefined) return null;
  return (
    <>
      <section className="accessapproval" aria-label="双人复核">
        <strong>高强度验证与双人复核</strong>
        <p>
          {model.editor?.kind === 'owner'
            ? '所有权转移会同时撤销当前所有者角色并授予新所有者，必须由另一位管理员对完全相同的目标、版本和原因签发凭证。'
            : '生成的请求码绑定操作、目标、请求内容和当前版本，必须由另一位拥有相同管理权限的管理员签发一次性凭证。'}
        </p>
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
          {destructive ? '我已核对新所有者、双方版本和不可逆影响' : '我已核对目标、版本和修改内容'}
        </label>
      </section>
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
          {model.mutation.busy ? '正在执行…' : destructive ? '确认转移所有权' : '确认执行'}
        </Button>
      </footer>
    </>
  );
}
