import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalFields } from './ApprovalFields';
import { DialogFooter } from './DialogFooter';

export function CardLibraryDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  const action = model.action;
  if (action?.kind !== 'createlibrary' && action?.kind !== 'allocatelibrary') return null;
  const allocate = action.kind === 'allocatelibrary';
  const invalid = allocate ? !model.scope.trim() || model.count < 1 || !model.proof || model.assurance < 3 : !/^[A-Za-z0-9]{2,16}$/.test(model.prefix.trim());
  return <Dialog open title={allocate ? '分配卡号库额度' : '新建卡号库'} eyebrow="卡号资产 · 安全生成" onClose={onClose} dismissable={!model.busy}><form onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}><div className="vouchercreatorbody">{allocate ? <><p>为目标商城或组织分配可用卡号额度，不展示任何真实卡号。</p><label className="vouchercreatorfield">目标范围编号<input value={model.scope} onChange={(event) => model.actions.scope(event.target.value)} required /></label><label className="vouchercreatorfield">分配数量<input type="number" min={1} max={100000} value={model.count} onChange={(event) => model.actions.count(Number(event.target.value))} required /></label><ApprovalFields model={model} /></> : <><p className="vouchercreatornotice">系统安全生成卡号；卡号内容不会出现在列表或日志中。</p><label className="vouchercreatorfield">卡号前缀<input aria-label="卡号前缀" value={model.prefix} onChange={(event) => model.actions.prefix(event.target.value)} maxLength={16} autoComplete="off" /><small>2–16 位英文字母或数字，例如 SW2026。</small></label></>}{model.error ? <p role="alert">{model.error}</p> : null}</div><DialogFooter busy={model.busy} disabled={invalid} label={allocate ? '确认分配' : '确认创建'} onClose={onClose} /></form></Dialog>;
}
