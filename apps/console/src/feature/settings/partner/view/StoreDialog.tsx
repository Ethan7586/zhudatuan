import { Dialog } from '@shop/design';
import type { PartnerStatus } from '../model/Partner';
import type { StoreEditor } from '../model/PartnerEditor';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';
import { DialogFooter, statusOptions } from './PartnerDialog';

export function StoreDialog({ model }: Readonly<{ model: PartnerViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'store') return null;
  return (
    <Dialog open title={editor.original ? '编辑门店' : '新建门店'} eyebrow="范围校验 · 地址加密 · 乐观锁" onClose={model.actions.close} dismissable={!model.saving.busy}>
      <form
        className="partnerform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        <div className="partnerformgrid">
          <label>
            门店名称
            <input value={editor.name} minLength={2} maxLength={160} disabled={model.reviewing} onChange={(event) => model.actions.name(event.target.value)} required />
          </label>
          <label>
            状态
            <select value={editor.status} disabled={model.reviewing} onChange={(event) => model.actions.status(event.target.value as PartnerStatus)}>
              {statusOptions}
            </select>
          </label>
          <label>
            所属商城引用
            <input value={editor.mallId} maxLength={255} disabled={model.reviewing} onChange={(event) => model.actions.mallId(event.target.value)} placeholder="可留空；集团下可填写下属商城引用" />
          </label>
          <label>
            区域编码
            <input value={editor.regionCode} minLength={2} maxLength={32} disabled={model.reviewing} onChange={(event) => model.actions.regionCode(event.target.value)} placeholder="例如 CN-31" required />
          </label>
          <label>
            服务半径（米）
            <input type="number" min={1} max={1000000} step={1} value={editor.radius} disabled={model.reviewing} onChange={(event) => model.actions.radius(event.target.value)} placeholder="留空表示不限制" />
          </label>
        </div>
        <fieldset disabled={model.reviewing}>
          <legend>详细地址</legend>
          {addressChoice('preserve', '保持原地址', editor, model, !editor.original)}
          {addressChoice('replace', editor.original ? '替换为新地址' : '填写地址', editor, model)}
          {addressChoice('remove', '清除地址', editor, model, !editor.original)}
        </fieldset>
        {editor.addressMode === 'replace' ? (
          <label>
            新地址
            <textarea value={editor.address} minLength={4} maxLength={1000} disabled={model.reviewing} onChange={(event) => model.actions.address(event.target.value)} autoComplete="street-address" required />
          </label>
        ) : null}
        <p className="partnerprivacy">
          {model.reviewing
            ? `请确认：将${editor.original ? '更新' : '创建'}门店“${editor.name.trim()}”，区域 ${editor.regionCode.trim()}，地址处理方式为“${addressLabel(editor.addressMode)}”。`
            : '地址仅在本次提交中发送，服务端使用 PII 专用密钥加密；读取接口不会返回地址明文。'}
        </p>
        <DialogFooter model={model} />
      </form>
    </Dialog>
  );
}

function addressLabel(value: StoreEditor['addressMode']) {
  return { preserve: '保持', replace: '安全替换', remove: '清除' }[value];
}

function addressChoice(value: StoreEditor['addressMode'], label: string, editor: StoreEditor, model: PartnerViewModel, hidden = false) {
  return hidden ? null : (
    <label>
      <input type="radio" name="addressmode" checked={editor.addressMode === value} onChange={() => model.actions.addressMode(value)} />
      {label}
    </label>
  );
}
