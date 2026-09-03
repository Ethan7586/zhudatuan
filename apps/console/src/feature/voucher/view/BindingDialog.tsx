import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { DialogFooter } from './DialogFooter';

export function BindingDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'bind') return null;
  const invalid = !model.member.trim() || model.reason.trim().length < 4 || model.assurance < 2;
  return <Dialog open title="绑定卡券" eyebrow="卡券实例 · 成员范围校验" onClose={onClose} dismissable={!model.busy}><form onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}><div className="vouchercreatorbody"><p>仅填写已有成员编号；这里不创建待确认的客户档案。</p><label className="vouchercreatorfield">成员编号<input value={model.member} onChange={(event) => model.actions.member(event.target.value)} required /></label><label className="vouchercreatorfield">绑定原因<textarea value={model.reason} maxLength={1000} onChange={(event) => model.actions.reason(event.target.value)} required /></label>{model.error ? <p role="alert">{model.error}</p> : null}</div><DialogFooter busy={model.busy} disabled={invalid} label="确认绑定" onClose={onClose} /></form></Dialog>;
}
