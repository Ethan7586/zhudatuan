import { Button, Dialog } from '@shop/design';
import type { QualificationViewModel } from '../viewmodel/QualificationViewModel';
import { ImpactPanel } from './ImpactPanel';

export function PolicyDialog({ model }: Readonly<{ model: QualificationViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind === 'decision') return null;
  const rollback = editor.kind === 'rollback';
  return (
    <Dialog
      open
      title={rollback ? '回滚资格策略' : editor.expectedVersion === 0 ? '创建资格策略' : '发布资格策略新版'}
      eyebrow="影响预览 · 乐观锁 · Step-up · 追加式回滚"
      description="已发布版本永不覆盖；每次发布或回滚都会形成新的、可审计的生效快照。"
      onClose={model.actions.close}
      dismissable={!model.previewing.busy && !model.saving.busy}
    >
      <form
        className="qualificationform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        {rollback ? <RollbackFields model={model} /> : <PublishFields model={model} />}
        {model.impact ? <ImpactPanel impact={model.impact} /> : <p className="qualificationhint">先生成服务端影响预览。预览会读取最新版本、历史快照及关联约束，但不会修改任何数据。</p>}
        {model.previewing.error ? (
          <p className="qualificationerror" role="alert">
            {model.previewing.error}
          </p>
        ) : null}
        {model.impact ? <ApprovalFields model={model} /> : null}
        {model.saving.error ? (
          <p className="qualificationerror" role="alert">
            {model.saving.error}
          </p>
        ) : null}
        {model.validation ? <p className="qualificationvalidation">{model.validation}</p> : null}
        <footer>
          <Button onPress={model.actions.close} isDisabled={model.previewing.busy || model.saving.busy}>
            取消
          </Button>
          <Button onPress={model.actions.preview} isDisabled={model.previewing.busy || model.saving.busy}>
            {model.previewing.busy ? '正在分析…' : model.impact ? '重新预览' : '生成影响预览'}
          </Button>
          <Button type="submit" tone={rollback ? 'danger' : 'primary'} isDisabled={model.saving.busy || model.validation !== undefined}>
            {model.saving.busy ? '正在提交…' : rollback ? '确认追加式回滚' : '确认发布'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function PublishFields({ model }: Readonly<{ model: QualificationViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind !== 'publish') return null;
  return (
    <div className="qualificationfields">
      <label>
        策略标识
        <input value={editor.id} onChange={(event) => model.actions.id(event.target.value)} readOnly={editor.expectedVersion > 0} placeholder="policy:employee" />
      </label>
      <label>
        策略名称
        <input value={editor.name} onChange={(event) => model.actions.name(event.target.value)} maxLength={255} placeholder="员工购买资格" />
      </label>
      <label className="qualificationwide">
        规则 JSON
        <textarea value={editor.rule} onChange={(event) => model.actions.rule(event.target.value)} spellCheck={false} aria-describedby="qualificationrulehelp" />
      </label>
      <p id="qualificationrulehelp" className="qualificationwide qualificationhint">
        常用字段：effect（allow/deny）、allowed、cityCodes、requiredTags、excludedTags。未知扩展字段会被保留；服务端负责最终校验。
      </p>
    </div>
  );
}

function RollbackFields({ model }: Readonly<{ model: QualificationViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind !== 'rollback') return null;
  return (
    <div className="qualificationfields">
      <label>
        策略
        <input value={editor.policy.name} readOnly />
      </label>
      <label>
        目标历史版本
        <select value={editor.version} onChange={(event) => model.actions.version(Number(event.target.value))}>
          {editor.policy.versions
            .filter((item) => item.version !== editor.expectedVersion)
            .map((item) => (
              <option key={item.version} value={item.version}>
                v{item.version} · {item.ruleHash.slice(0, 10)}…
              </option>
            ))}
        </select>
      </label>
      <p className="qualificationwide qualificationhint">系统会复制所选版本的规则、资源、人群与限购关系，发布为 v{editor.expectedVersion + 1}；原版本链保持不变。</p>
    </div>
  );
}

function ApprovalFields({ model }: Readonly<{ model: QualificationViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind === 'decision') return null;
  return (
    <section className="qualificationapproval">
      <strong>发布确认</strong>
      <p>操作凭证与资格策略发布操作绑定，并由服务端再次校验当前版本。版本已变化时会拒绝写入，不会静默覆盖。</p>
      {model.assurance < 3 ? (
        <Button tone="primary" onPress={model.actions.stepup}>
          完成高强度二次验证
        </Button>
      ) : null}
      <label>
        一次性操作凭证
        <input value={editor.proof} onChange={(event) => model.actions.proof(event.target.value)} autoComplete="off" spellCheck={false} placeholder="粘贴 Step-up 签发的凭证" />
      </label>
      <label className="qualificationconfirm">
        <input type="checkbox" checked={editor.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        <span>我已核对目标版本、变化路径、潜在成员和全部关联约束</span>
      </label>
    </section>
  );
}
