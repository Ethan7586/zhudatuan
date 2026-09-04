import { Button, Dialog } from '@shop/design';
import type { RiskCaseAction } from '../model/Risk';
import type { RiskViewModel } from '../viewmodel/RiskViewModel';
import { RiskApproval } from './RiskApproval';

export function RiskDialog({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  return (
    <Dialog
      open
      title={title(editor.kind)}
      eyebrow="预览 · 双人复核 · Step-up · 乐观锁 · 权威重读"
      description="所有命令都绑定当前聚合版本；并发更新会被拒绝，不会覆盖他人的最新结果。"
      onClose={model.actions.close}
      dismissable={!model.mutation.busy}
    >
      <form
        className="riskform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.submit();
        }}
      >
        {editor.kind === 'save' ? <SaveFields model={model} /> : editor.kind === 'case' ? <CaseFields model={model} /> : <PolicyDecision model={model} />}
        {model.reviewing ? <RiskPreview model={model} /> : <p className="riskhint">填写完成后进入最终预览。激活策略时，预览数据直接来自服务端已完成的历史样本回放。</p>}
        {model.reviewing ? <RiskApproval model={model} /> : null}
        {model.mutation.error ? (
          <p className="riskerror" role="alert">
            {model.mutation.error}
          </p>
        ) : null}
        {model.validation ? <p className="riskvalidation">{model.validation}</p> : null}
        <footer className="riskdialogactions">
          <Button onPress={model.actions.close} isDisabled={model.mutation.busy}>
            取消
          </Button>
          {model.reviewing ? (
            <Button onPress={model.actions.edit} isDisabled={model.mutation.busy}>
              返回修改
            </Button>
          ) : (
            <Button tone="primary" onPress={model.actions.preview} isDisabled={model.validation !== undefined}>
              进入最终预览
            </Button>
          )}
          <Button type="submit" tone={destructive(editor.kind) ? 'danger' : 'primary'} isDisabled={model.mutation.busy || model.validation !== undefined}>
            {model.mutation.busy ? '正在执行…' : '确认执行'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function SaveFields({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'save') return null;
  return (
    <div className="riskfields">
      <label>
        策略标识
        <input value={editor.id} readOnly={editor.expectedVersion > 0} onChange={(event) => model.actions.id(event.target.value)} />
      </label>
      <label>
        策略名称
        <input value={editor.name} maxLength={255} onChange={(event) => model.actions.name(event.target.value)} />
      </label>
      <label>
        候选流量比例
        <input type="number" min={0} max={100} step={1} value={editor.rolloutPercent} onChange={(event) => model.actions.rollout(Number(event.target.value))} />
      </label>
      <label className="riskwide">
        策略规则 JSON
        <textarea value={editor.rule} spellCheck={false} onChange={(event) => model.actions.rule(event.target.value)} />
      </label>
      <p className="riskwide riskhint">保存只会产生候选版本并排队执行历史样本回放，不会直接参与实时决策。规则支持名单、操作、金额、频次、信号评分和分级阈值。</p>
    </div>
  );
}

function PolicyDecision({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (!editor || (editor.kind !== 'activate' && editor.kind !== 'retire')) return null;
  return (
    <section className="risksummary">
      <strong>{editor.policy.name}</strong>
      <dl>
        <div>
          <dt>当前聚合</dt>
          <dd>v{editor.expectedVersion}</dd>
        </div>
        <div>
          <dt>当前状态</dt>
          <dd>{editor.policy.status}</dd>
        </div>
        {editor.kind === 'activate' ? (
          <>
            <div>
              <dt>候选版本</dt>
              <dd>v{editor.policy.candidateVersion}</dd>
            </div>
            <div>
              <dt>激活流量</dt>
              <dd>
                <input aria-label="激活流量比例" type="number" min={0} max={100} step={1} value={editor.rolloutPercent} onChange={(event) => model.actions.rollout(Number(event.target.value))} />%
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function CaseFields({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (editor?.kind !== 'case') return null;
  return (
    <div className="riskfields">
      <label>
        处置动作
        <select value={editor.action} onChange={(event) => model.actions.caseAction(event.target.value as RiskCaseAction)}>
          {caseActions(editor.riskCase.state).map((action) => (
            <option key={action} value={action}>
              {caseActionLabel(action)}
            </option>
          ))}
        </select>
      </label>
      <label>
        案件版本
        <input value={`v${editor.expectedVersion}`} readOnly />
      </label>
      <label className="riskwide">
        复核原因
        <textarea value={editor.reason} minLength={4} maxLength={1000} onChange={(event) => model.actions.reason(event.target.value)} />
      </label>
      <label className="riskwide">
        补充证据 JSON
        <textarea value={editor.evidence} spellCheck={false} onChange={(event) => model.actions.evidence(event.target.value)} />
      </label>
    </div>
  );
}

function RiskPreview({ model }: Readonly<{ model: RiskViewModel }>) {
  const editor = model.editor;
  if (!editor) return null;
  if (editor.kind === 'activate')
    return (
      <section className="riskpreview">
        <strong>服务端历史样本回放已通过</strong>
        <div>
          <span>样本 {editor.policy.sampleCount ?? 0} 条</span>
          <span>决策变化 {editor.policy.changedCount ?? 0} 条</span>
          <span>误报率 {editor.policy.falsePositiveRate === null ? '—' : `${(editor.policy.falsePositiveRate * 100).toFixed(2)}%`}</span>
          <span>灰度 {editor.rolloutPercent}%</span>
        </div>
        <p>激活后候选 v{editor.policy.candidateVersion} 成为实时决策版本；上一版本保留为基线，服务端仍会执行创建人与激活人分离校验。</p>
      </section>
    );
  if (editor.kind === 'save')
    return (
      <section className="riskpreview">
        <strong>候选版本变更预览</strong>
        <div>
          <span>目标 {editor.expectedVersion === 0 ? '新策略' : `聚合 v${editor.expectedVersion}`}</span>
          <span>灰度 {editor.rolloutPercent}%</span>
          <span>将排队执行服务端历史回放</span>
        </div>
        <p>确认后仅创建新候选版本及回放任务；回放通过前不会出现激活入口。</p>
      </section>
    );
  if (editor.kind === 'retire')
    return (
      <section className="riskpreview">
        <strong>停用影响预览</strong>
        <p>策略将不再参与新风险决策；历史版本、命中决定和审计记录仍完整保留。</p>
      </section>
    );
  return (
    <section className="riskpreview">
      <strong>案件处置预览</strong>
      <p>案件将执行“{caseActionLabel(editor.action)}”；原因与补充证据会写入权威记录，终态处置会发布风险案件解决事件。</p>
    </section>
  );
}

function title(kind: NonNullable<RiskViewModel['editor']>['kind']): string {
  return kind === 'save' ? '保存候选风险策略' : kind === 'activate' ? '激活风险策略' : kind === 'retire' ? '停用风险策略' : '复核风险案件';
}
function destructive(kind: NonNullable<RiskViewModel['editor']>['kind']): boolean {
  return kind === 'activate' || kind === 'retire' || kind === 'case';
}
function caseActions(state: string): readonly RiskCaseAction[] {
  return state === 'open' ? ['accept'] : state === 'reviewing' ? ['clear', 'confirm'] : ['close'];
}
function caseActionLabel(action: RiskCaseAction): string {
  return action === 'accept' ? '接单复核' : action === 'clear' ? '排除风险' : action === 'confirm' ? '确认风险' : '关闭案件';
}
