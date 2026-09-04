import { Button, Dialog } from '@shop/design';
import type { PartnerStatus } from '../model/Partner';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';

export function PartnerDialog({ model }: Readonly<{ model: PartnerViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'partner') return null;
  return (
    <Dialog
      open
      title={editor.original ? `编辑${editor.partnerKind === 'supplier' ? '供应商' : '品牌'}` : `新建${editor.partnerKind === 'supplier' ? '供应商' : '品牌'}`}
      eyebrow="服务端版本 · 稳定幂等 · 权威回读"
      onClose={model.actions.close}
      dismissable={!model.saving.busy}
    >
      <form
        className="partnerform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <label>
          名称
          <input value={editor.name} minLength={2} maxLength={160} disabled={model.reviewing} onChange={(event) => model.actions.name(event.target.value)} required />
        </label>
        <label>
          状态
          <select value={editor.status} disabled={model.reviewing} onChange={(event) => model.actions.status(event.target.value as PartnerStatus)}>
            {statusOptions}
          </select>
        </label>
        <p className="partnerprivacy">
          {model.reviewing
            ? `请确认：将${editor.original ? '更新' : '创建'}${editor.partnerKind === 'supplier' ? '供应商' : '品牌'}“${editor.name.trim()}”，状态为“${statusLabel(editor.status)}”。`
            : `新建记录使用服务端可审计引用；编辑会校验第 ${editor.original?.version ?? 0} 版，若期间已被他人更新将要求重读。`}
        </p>
        <DialogFooter model={model} />
      </form>
    </Dialog>
  );
}

export const statusOptions = (
  <>
    <option value="pending">待完善</option>
    <option value="active">正常</option>
    <option value="suspended">已暂停</option>
    <option value="terminated">已终止</option>
  </>
);
export function DialogFooter({ model }: Readonly<{ model: PartnerViewModel }>) {
  return (
    <>
      {model.reviewing && model.assurance < 2 ? (
        <Button tone="primary" onPress={model.actions.stepup}>
          完成二次验证
        </Button>
      ) : null}
      {model.saving.error ? (
        <p className="partnererror" role="alert">
          {model.saving.error}
        </p>
      ) : null}
      {model.validation ? <p className="partnervalidation">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.reviewing ? model.actions.revise : model.actions.close} isDisabled={model.saving.busy}>
          {model.reviewing ? '返回修改' : '取消'}
        </Button>
        {model.reviewing ? (
          <Button type="submit" tone="primary" isDisabled={model.saving.busy || model.assurance < 2 || model.validation !== undefined}>
            {model.saving.busy ? '正在保存…' : '确认保存'}
          </Button>
        ) : (
          <Button tone="primary" onPress={model.actions.preview} isDisabled={model.validation !== undefined}>
            预览变更
          </Button>
        )}
      </footer>
    </>
  );
}

function statusLabel(value: PartnerStatus) {
  return { pending: '待完善', active: '正常', suspended: '已暂停', terminated: '已终止' }[value];
}
