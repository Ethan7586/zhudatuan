import { Dialog } from '@shop/design';
import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalFields } from './ApprovalFields';
import { DialogFooter } from './DialogFooter';

export function IssueDialog({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  if (model.action?.kind !== 'issuebatch' && model.action?.kind !== 'retrybatch') return null;
  const retry = model.action.kind === 'retrybatch';
  const invalid = !model.proof || model.assurance < 3 || (!retry && (!model.program.trim() || !model.cardpool.trim() || model.count < 1 || model.version < 0));
  return (
    <Dialog open title={retry ? '重试发行批次' : '创建发行批次'} eyebrow="卡券发行 · 异步任务 · 双人复核" onClose={onClose} dismissable={!model.busy}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="vouchercreatorbody">
          {retry ? (
            <p>仅失败且没有运行中任务的批次可重试；系统会从权威进度继续，不重复发行成功记录。</p>
          ) : (
            <>
              <label className="vouchercreatorfield">
                卡券方案编号
                <input value={model.program} onChange={(event) => model.actions.program(event.target.value)} required />
              </label>
              <label className="vouchercreatorfield">
                方案版本
                <input type="number" min={0} value={model.version} onChange={(event) => model.actions.version(Number(event.target.value))} required />
              </label>
              <label className="vouchercreatorfield">
                卡号库编号
                <input value={model.cardpool} onChange={(event) => model.actions.cardpool(event.target.value)} required />
              </label>
              <label className="vouchercreatorfield">
                备券申请编号（无需审批时可留空）
                <input value={model.reserve} onChange={(event) => model.actions.reserve(event.target.value)} />
              </label>
              <label className="vouchercreatorfield">
                发行数量
                <input type="number" min={1} max={100000} value={model.count} onChange={(event) => model.actions.count(Number(event.target.value))} required />
              </label>
            </>
          )}
          <ApprovalFields model={model} />
          {model.error ? <p role="alert">{model.error}</p> : null}
        </div>
        <DialogFooter busy={model.busy} disabled={invalid} label={retry ? '确认重试' : '提交发行'} onClose={onClose} />
      </form>
    </Dialog>
  );
}
