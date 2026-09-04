import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { DialogFooter } from './DialogFooter';

export function ReserveDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'requestreserve') return null;
  const invalid = !model.program.trim() || model.count < 1 || model.reason.trim().length < 4 || model.assurance < 2;
  return (
    <Dialog open title="申请备券" eyebrow="备券中心 · 经办申请" onClose={onClose} dismissable={!model.busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="vouchercreatorbody">
          <label className="vouchercreatorfield">
            卡券方案编号
            <input value={model.program} onChange={(event) => model.actions.program(event.target.value)} required />
          </label>
          <label className="vouchercreatorfield">
            申请数量
            <input type="number" min={1} max={100000} value={model.count} onChange={(event) => model.actions.count(Number(event.target.value))} required />
          </label>
          <label className="vouchercreatorfield">
            申请原因
            <textarea value={model.reason} maxLength={1000} onChange={(event) => model.actions.reason(event.target.value)} required />
          </label>
          <p>申请人与审批人必须分离；启用审批的方案只接受已批准备券单。</p>
          {model.error ? <p role="alert">{model.error}</p> : null}
        </div>
        <DialogFooter busy={model.busy} disabled={invalid} label="提交备券申请" onClose={onClose} />
      </form>
    </Dialog>
  );
}
