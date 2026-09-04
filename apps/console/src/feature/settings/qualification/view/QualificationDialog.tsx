import { Button, Dialog } from '@shop/design';
import type { EvidenceKind, QualificationTargetKind } from '../model/Qualification';
import type { QualificationCaseViewModel } from '../viewmodel/QualificationCaseViewModel';
import { targetLabel } from './QualificationTable';

export function QualificationDialog({ model }: Readonly<{ model: QualificationCaseViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  const revoking = editor.kind === 'revoke';
  return (
    <Dialog
      open
      title={revoking ? '撤销经营资质' : '发布经营资质'}
      eyebrow={revoking ? '立即阻断新交易 · 自动下架' : '上传材料 · 服务端核验 · 到期自动处理'}
      description={revoking ? '撤销不可由浏览器撤回；相关商品会经风险链路自动转为下架。' : '材料将直传对象存储，服务端核对引用、SHA-256 和安全扫描结果后才允许发布。'}
      onClose={model.actions.close}
      dismissable={!model.busy}
    >
      <form className="qualificationform" onSubmit={(event) => { event.preventDefault(); model.actions.submit(); }}>
        {revoking ? <RevokeFields model={model} /> : <PublishFields model={model} />}
        {model.error ? <p className="qualificationerror" role="alert">{model.error}</p> : null}
        <Approval model={model} />
        {model.validation ? <p className="qualificationvalidation">{model.validation}</p> : null}
        <footer>
          <Button onPress={model.actions.close} isDisabled={model.busy}>取消</Button>
          <Button type="submit" tone={revoking ? 'danger' : 'primary'} isDisabled={model.busy || model.validation !== undefined}>
            {model.busy ? '正在处理…' : revoking ? '确认撤销并联动商品' : '核验材料并发布'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function PublishFields({ model }: Readonly<{ model: QualificationCaseViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind !== 'publish') return null;
  return (
    <div className="qualificationfields">
      <label>资质名称<input value={editor.title} onChange={(event) => model.actions.update({ title: event.target.value })} placeholder="食品经营许可证" maxLength={255} /></label>
      <label>
        持证主体类型
        <select value={editor.subjectKind} onChange={(event) => model.actions.update({ subjectKind: event.target.value as QualificationTargetKind, subjectId: '' })}>
          <option value="partner">合作方</option><option value="product">商品</option><option value="category">类目</option><option value="region">区域</option>
        </select>
      </label>
      <label>持证主体标识<input value={editor.subjectId} onChange={(event) => model.actions.update({ subjectId: event.target.value })} placeholder={`${editor.subjectKind}:...`} /></label>
      <label className="qualificationwide">
        适用对象
        <textarea className="qualificationtargets" value={editor.applicability} onChange={(event) => model.actions.update({ applicability: event.target.value })} placeholder={'每行一项，例如：\nproduct:商品标识\ncategory:类目标识\nregion:区域标识'} />
        <small>支持商品、类目、区域和合作方标识；逐行填写，系统会自动去重并限制最多 100 项。</small>
      </label>
      <label>生效时间（可选）<input type="datetime-local" value={editor.effectiveAt} onChange={(event) => model.actions.update({ effectiveAt: event.target.value })} /></label>
      <label>失效时间<input type="datetime-local" value={editor.expiresAt} onChange={(event) => model.actions.update({ expiresAt: event.target.value })} /></label>
      <label>
        材料类型
        <select value={editor.evidenceKind} onChange={(event) => model.actions.update({ evidenceKind: event.target.value as EvidenceKind, evidence: undefined })}>
          <option value="license">许可证</option><option value="certificate">证书</option><option value="authorization">授权书</option><option value="agreement">协议</option><option value="other">其他</option>
        </select>
      </label>
      <label>
        选择材料
        <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={!model.canUpload || model.busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) model.actions.upload(file); }} />
      </label>
      <p className="qualificationwide qualificationhint">支持 JPG、PNG、PDF，单份不超过 10 MB。{editor.evidence ? ` 已上传：${editor.evidence.name}（校验码 ${editor.evidence.sha256.slice(0, 12)}…）` : ' 上传完成后才可发布。'}</p>
    </div>
  );
}

function RevokeFields({ model }: Readonly<{ model: QualificationCaseViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind !== 'revoke') return null;
  return (
    <section className="qualificationimpact">
      <strong>{editor.qualification.title}</strong>
      <p>{targetLabel(editor.qualification.subject.kind)} {editor.qualification.subject.id} · 当前 v{editor.qualification.version}</p>
      <label>撤销原因<textarea className="qualificationreason" value={editor.reason} onChange={(event) => model.actions.update({ reason: event.target.value })} maxLength={500} placeholder="说明撤销依据，便于审计和后续处理" /></label>
    </section>
  );
}

function Approval({ model }: Readonly<{ model: QualificationCaseViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  return (
    <section className="qualificationapproval">
      <strong>高风险操作确认</strong>
      <p>{editor.kind === 'revoke' ? '撤销会立即影响新交易并触发商品风险处理。' : '服务端会再次核对材料完整性、案件版本和失效时间。'}</p>
      {model.assurance < 3 ? <Button tone="primary" onPress={model.actions.stepup}>完成高强度二次验证</Button> : null}
      <label>一次性操作凭证<input value={editor.proof} onChange={(event) => model.actions.proof(event.target.value)} autoComplete="off" spellCheck={false} placeholder="粘贴 Step-up 签发的凭证" /></label>
      <label className="qualificationconfirm"><input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} /><span>我已核对材料、持证主体、适用对象和有效期，并理解该操作的业务影响</span></label>
    </section>
  );
}
