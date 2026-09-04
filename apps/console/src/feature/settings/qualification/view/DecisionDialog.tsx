import { Button, Dialog } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { QualificationViewModel } from '../viewmodel/QualificationViewModel';

export function DecisionDialog({ model }: Readonly<{ model: QualificationViewModel }>) {
  const editor = model.editor;
  if (!editor || editor.kind !== 'decision') return null;
  return (
    <Dialog open title="模拟资格决策" eyebrow="真实成员 · 真实资源 · 只读计算" description="模拟结果来自当前已发布策略，不会创建订单、占用限购额度或修改成员数据。" onClose={model.actions.close} dismissable={!model.previewing.busy}>
      <form
        className="qualificationform"
        onSubmit={(event) => {
          event.preventDefault();
          model.actions.preview();
        }}
      >
        <div className="qualificationfields">
          <label>
            成员标识
            <input value={editor.member} onChange={(event) => model.actions.member(event.target.value)} placeholder="member:employee" />
          </label>
          <label>
            商品资源标识
            <input value={editor.resource} onChange={(event) => model.actions.resource(event.target.value)} placeholder="listing:one" />
          </label>
        </div>
        {model.assurance < 2 ? (
          <section className="qualificationapproval">
            <strong>需要多因素验证</strong>
            <p>真实成员资格属于敏感业务信息，验证升级后才能模拟。</p>
            <Button tone="primary" onPress={model.actions.stepup}>
              立即验证
            </Button>
          </section>
        ) : null}
        {model.decisions ? (
          <section className="qualificationdecisions" aria-live="polite">
            <h3>权威模拟结果</h3>
            {model.decisions.length === 0 ? (
              <p>该成员不存在，或当前范围没有可参与决策的已发布策略。</p>
            ) : (
              <ul>
                {model.decisions.map((item) => (
                  <li key={item.policyId}>
                    <span>
                      {chineseReference('策略', item.policyId)} · v{item.policyVersion}
                    </span>
                    <strong className={`is-${item.decision}`}>{item.decision === 'eligible' ? '符合资格' : '不符合资格'}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        {model.previewing.error ? (
          <p className="qualificationerror" role="alert">
            {model.previewing.error}
          </p>
        ) : null}
        {model.validation ? <p className="qualificationvalidation">{model.validation}</p> : null}
        <footer>
          <Button onPress={model.actions.close} isDisabled={model.previewing.busy}>
            关闭
          </Button>
          <Button type="submit" tone="primary" isDisabled={model.previewing.busy || model.validation !== undefined}>
            {model.previewing.busy ? '正在计算…' : '开始模拟'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
