import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalFields } from './ApprovalFields';
import { DialogFooter } from './DialogFooter';

export function StatusBatchDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'statusbatch') return null;
  const invalid = !model.proof || model.assurance < 3 || model.reason.trim().length < 4 || (model.statusAction === 'extend' && !model.expiresAt);
  return (
    <Dialog open title={`批量操作 ${model.action.records.length} 张卡券`} eyebrow="状态批次 · 双人复核 · 异步执行" onClose={onClose} dismissable={!model.busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="vouchercreatorbody">
          <label className="vouchercreatorfield">
            操作
            <select value={model.statusAction} onChange={(event) => model.actions.statusAction(event.target.value as typeof model.statusAction)}>
              <option value="activate">激活</option>
              <option value="disable">禁用</option>
              <option value="extend">延期</option>
              <option value="void">作废</option>
            </select>
          </label>
          {model.statusAction === 'extend' ? (
            <label className="vouchercreatorfield">
              新有效期
              <input type="datetime-local" value={model.expiresAt} onChange={(event) => model.actions.expiresAt(event.target.value)} required />
            </label>
          ) : null}
          <ApprovalFields model={model} />
          {model.error ? <p role="alert">{model.error}</p> : null}
        </div>
        <DialogFooter busy={model.busy} disabled={invalid} label="提交批量任务" onClose={onClose} />
      </form>
    </Dialog>
  );
}
