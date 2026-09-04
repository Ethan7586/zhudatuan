import { Button, Dialog } from '@shop/design';
import type { CustomerEditor, CustomerProfileEditor } from '../model/CustomerEditor';
import type { CustomerViewModel } from '../viewmodel/CustomerViewModel';
import { customerKindText } from './CustomerTable';

export function CustomerDialog({ model }: Readonly<{ model: CustomerViewModel }>) {
  const editor = model.editor;
  if (editor === undefined) return null;
  const state = editor.mode === 'enable' || editor.mode === 'disable';
  const title = state ? `${editor.mode === 'disable' ? '停用' : '启用'}客户` : editor.mode === 'create' ? '新建客户' : '编辑客户';
  return <Dialog open title={title} eyebrow="字段权限 · 影响预演 · 版本校验" onClose={model.actions.close} dismissable={!model.saving.busy}>
    <form className="partnerform" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
      {isProfileEditor(editor) ? <CustomerProfileFields model={model} editor={editor} /> : <CustomerStateFields model={model} />}
      {model.conflict ? <section className="partnererror" role="alert" aria-label="客户并发冲突"><strong>{model.conflict.title}</strong><ul>{model.conflict.details.map((detail) => <li key={detail}>{detail}</li>)}</ul><Button onPress={model.actions.resolveConflict}>{model.conflict.customer ? '使用最新状态继续编辑' : '关闭并重新选择'}</Button></section> : null}
      {model.reviewing && model.assurance < 2 ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}
      {model.saving.error ? <p className="partnererror" role="alert">{model.saving.error}</p> : null}
      {model.validation ? <p className="partnervalidation">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.reviewing ? model.actions.revise : model.actions.close} isDisabled={model.saving.busy}>{model.reviewing ? '返回修改' : '取消'}</Button>
        {model.reviewing
          ? <Button type="submit" tone={editor.mode === 'disable' ? 'danger' : 'primary'} isDisabled={model.saving.busy || model.assurance < 2 || model.validation !== undefined}>{model.saving.busy ? '正在提交…' : '确认执行'}</Button>
          : <Button tone="primary" onPress={model.actions.preview} isDisabled={model.validation !== undefined}>预览影响</Button>}
      </footer>
    </form>
  </Dialog>;
}

function isProfileEditor(editor: CustomerEditor): editor is CustomerProfileEditor {
  return editor.mode === 'create' || editor.mode === 'update';
}

function CustomerStateFields({ model }: Readonly<{ model: CustomerViewModel }>) {
  const editor = model.editor;
  if (editor?.mode !== 'enable' && editor?.mode !== 'disable') return null;
  const disabling = editor.mode === 'disable';
  return <>
    <section className="customerimpact" aria-label="停用影响预演">
      <strong>{disabling ? `停用“${editor.original.name}”后的业务影响` : `启用“${editor.original.name}”前的业务检查`}</strong>
      <ul>{disabling ? <><li>该客户将立即从新备券、发券和渠道业务的可选客户中移除。</li><li>进行中的请求由对应领域按当前状态继续或阻断，不会伪造成功。</li><li>既有卡券、订单、资金与审计证据完整保留，不删除历史。</li></> : <><li>服务端将再次校验合作协议处于有效期内。</li><li>启用成功后，该客户才会重新进入下游业务选择项。</li></>}</ul>
    </section>
    <label>操作原因<textarea value={editor.reason} minLength={4} maxLength={500} disabled={model.reviewing} onChange={(event) => model.actions.update({ reason: event.target.value })} required /></label>
    {model.reviewing ? <p className="partnerprivacy">请确认将客户状态变更为“{disabling ? '已停用' : '合作中'}”；提交时校验第 {editor.original.version} 版，成功后权威回读。</p> : null}
  </>;
}

function CustomerProfileFields({ model, editor }: Readonly<{ model: CustomerViewModel; editor: CustomerProfileEditor }>) {
  const update = model.actions.update;
  const creating = editor.mode === 'create';
  return <>
    <div className="partnerformgrid">
      <label>{creating ? '客户识别号' : '更新客户识别号（留空保持）'}<input value={editor.identifier} minLength={creating ? 5 : undefined} maxLength={64} autoComplete="off" disabled={model.reviewing} onChange={(event) => update({ identifier: event.target.value })} required={creating} /></label>
      <label>客户名称<input value={editor.name} minLength={2} maxLength={160} disabled={model.reviewing} onChange={(event) => update({ name: event.target.value })} required /></label>
      <label>客户类型<select value={editor.customerKind} disabled={model.reviewing} onChange={(event) => update({ customerKind: event.target.value as CustomerProfileEditor['customerKind'] })}><option value="enterprise">企业</option><option value="institution">事业单位</option><option value="government">政府机构</option></select></label>
      {!creating ? <label>联系人字段权限<select value={editor.contactMode} disabled={model.reviewing} onChange={(event) => update({ contactMode: event.target.value as CustomerProfileEditor['contactMode'] })}><option value="preserve">保留现有脱敏联系人</option><option value="replace">重新填写并替换</option></select></label> : null}
    </div>
    {editor.contactMode === 'replace' ? <fieldset className="customerfieldset"><legend>联系人（敏感字段仅写入）</legend><div className="partnerformgrid">
      <label>用途<select value={editor.contactKind} disabled={model.reviewing} onChange={(event) => update({ contactKind: event.target.value as CustomerProfileEditor['contactKind'] })}><option value="primary">主要联系人</option><option value="billing">财务联系人</option><option value="operations">业务联系人</option></select></label>
      <label>姓名<input value={editor.contactName} maxLength={128} autoComplete="off" disabled={model.reviewing} onChange={(event) => update({ contactName: event.target.value })} required /></label>
      <label>手机<input value={editor.phone} maxLength={32} inputMode="tel" autoComplete="off" disabled={model.reviewing} onChange={(event) => update({ phone: event.target.value })} /></label>
      <label>邮箱<input value={editor.email} maxLength={254} type="email" autoComplete="off" disabled={model.reviewing} onChange={(event) => update({ email: event.target.value })} /></label>
    </div></fieldset> : null}
    <label>合作协议<select value={editor.agreementMode} disabled={model.reviewing} onChange={(event) => update({ agreementMode: event.target.value as CustomerProfileEditor['agreementMode'] })}>{creating ? <option value="none">暂不配置</option> : <option value="preserve">保留当前协议</option>}<option value="replace">填写新协议</option></select></label>
    {editor.agreementMode === 'replace' ? <fieldset className="customerfieldset"><legend>协议与可用能力</legend><div className="partnerformgrid">
      <label>协议引用<input value={editor.contractRef} maxLength={128} disabled={model.reviewing} onChange={(event) => update({ contractRef: event.target.value })} required /></label>
      <label>文件 SHA-256<input value={editor.contractHash} minLength={64} maxLength={64} spellCheck={false} disabled={model.reviewing} onChange={(event) => update({ contractHash: event.target.value })} required /></label>
      <label>生效日期<input type="date" value={editor.effectiveDate} disabled={model.reviewing} onChange={(event) => update({ effectiveDate: event.target.value })} required /></label>
      <label>到期日期<input type="date" value={editor.expiryDate} disabled={model.reviewing} onChange={(event) => update({ expiryDate: event.target.value })} required /></label>
    </div><label>协议能力<textarea value={editor.capabilities} placeholder="例如：voucher.issue, channel.order（逗号或换行分隔）" disabled={model.reviewing} onChange={(event) => update({ capabilities: event.target.value })} required /></label></fieldset> : null}
    <p className="partnerprivacy">识别号、联系人姓名、手机和邮箱不会从服务端回显明文；只有具备当前{creating ? '新增' : '更新'} Operation 权限的人员能提交，服务端使用 KMS 加密并保留脱敏投影。</p>
    {model.reviewing ? <section className="customerimpact" aria-label="客户字段变更预演"><strong>即将{creating ? '创建' : '更新'} {customerKindText(editor.customerKind)}“{editor.name.trim()}”</strong><ul><li>{editor.contactMode === 'replace' ? '联系人敏感字段将被加密替换。' : '现有联系人保持不变。'}</li><li>{editor.agreementMode === 'replace' ? '合作协议及能力边界将更新。' : '现有合作协议保持不变。'}</li><li>提交后以服务端返回的版本和脱敏字段为准。</li></ul></section> : null}
  </>;
}
