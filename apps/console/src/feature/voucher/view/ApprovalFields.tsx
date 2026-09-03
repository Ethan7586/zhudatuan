import { Button } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';

export function ApprovalFields({ model }: Readonly<{ model: VoucherActionViewModel }>) {
  return (
    <section className="voucherapproval" aria-label="双人复核">
      <label>审计原因<textarea value={model.reason} maxLength={1000} onChange={(event) => model.actions.reason(event.target.value)} required /></label>
      <Button onPress={model.actions.requestApproval} isDisabled={model.reason.trim().length < 4 || model.busy}>生成复核请求码</Button>
      {model.approval ? <><label>复核请求码<textarea value={model.approval} readOnly /></label><Button onPress={() => void navigator.clipboard.writeText(model.approval)}>复制请求码</Button><p>交给另一位具备同一权限的管理员，由其在“完成二次验证”中签发一次性凭证。</p></> : null}
      <label>一次性复核凭证<input value={model.proof} autoComplete="off" spellCheck={false} onChange={(event) => model.actions.proof(event.target.value.trim())} required /></label>
      <p>{model.assurance >= 3 ? '当前会话已完成高强度验证；请求、目标版本与操作内容仍会逐项绑定。' : '请先通过页面右上角完成二次验证，再提交另一位管理员签发的复核凭证。'}</p>
    </section>
  );
}
