import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalFields } from './ApprovalFields';
import { DialogFooter } from './DialogFooter';

export function ApprovalDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'decidereserve') return null;
  const invalid = model.reason.trim().length < 4 || !model.proof || model.assurance < 3;
  return <Dialog open title="审批备券申请" eyebrow="审批 · 双人复核 · 版本保护" onClose={onClose} dismissable={!model.busy}><form onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}><div className="vouchercreatorbody"><label className="vouchercreatorfield">审批结论<select value={model.decision} onChange={(event) => model.actions.decision(event.target.value as typeof model.decision)}><option value="approved">批准</option><option value="rejected">驳回</option></select></label><ApprovalFields model={model} />{model.error ? <p role="alert">{model.error}</p> : null}</div><DialogFooter busy={model.busy} disabled={invalid} label="确认审批" onClose={onClose} /></form></Dialog>;
}
