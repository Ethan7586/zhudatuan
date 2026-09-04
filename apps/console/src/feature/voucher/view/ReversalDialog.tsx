import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalFields } from './ApprovalFields';
import { DialogFooter } from './DialogFooter';

export function ReversalDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'reverse') return null;
  const invalid = !model.proof || model.assurance < 3 || model.reason.trim().length < 4;
  return (
    <Dialog open title="冲正消费记录" eyebrow="消费明细 · 双人复核 · 不可重复" onClose={onClose} dismissable={!model.busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="vouchercreatorbody">
          <p>冲正成功后由服务端恢复权威余额并写入不可变状态历史，同一消费记录不可重复冲正。</p>
          <ApprovalFields model={model} />
          {model.error ? <p role="alert">{model.error}</p> : null}
        </div>
        <DialogFooter busy={model.busy} disabled={invalid} label="确认冲正" onClose={onClose} />
      </form>
    </Dialog>
  );
}
