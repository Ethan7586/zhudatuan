import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import type { AuditViewModel } from '../viewmodel/AuditViewModel';
import { FinanceTabs } from './FinanceTabs';
import { AuditResult } from './AuditResult';
import './FinanceWorkspace.css';

export function AuditPage({ title, model }: Readonly<{ title: string; model: AuditViewModel }>) {
  if (model.needsStepup) return <AssurancePrompt title={title} description="财务证据链包含账本、结算、发票与审计信息。请先完成短信二次验证，成功后会自动返回并加载查询页。" />;
  const data = model.data;
  return (
    <section className="financeprofessionalworkspace financeauditworkspace">
      <FinanceTabs model={model.navigation} />
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('财务管理')}
        description="输入订单号、支付单号、渠道流水号、账单号或财务业务编号，沿同一证据链核对账务、结算、发票和修复。"
        condition={model.condition}
        {...(model.error === undefined ? {} : { error: model.error })}
        retry={model.refresh}
        actions={<AuditSearch model={model} />}
      >
        {model.reference === undefined ? <AuditGuide /> : data === undefined ? null : <AuditResult data={data} />}
      </ResourcePanel>
    </section>
  );
}

function AuditSearch({ model }: Readonly<{ model: AuditViewModel }>) {
  return (
    <form
      className="financeauditsearch"
      role="search"
      aria-label="查询财务证据链"
      onSubmit={(event) => {
        event.preventDefault();
        model.search();
      }}
    >
      <label htmlFor="financeauditreference">业务编号</label>
      <input id="financeauditreference" name="reference" value={model.draft} maxLength={200} autoComplete="off" placeholder="例如：订单号、支付单号或渠道流水号" onChange={(event) => model.setDraft(event.target.value)} />
      <Button type="submit" tone="primary" isDisabled={model.draft.trim().length === 0}>
        查询证据链
      </Button>
      {model.reference === undefined ? null : <Button onPress={model.clear}>清除</Button>}
    </form>
  );
}

function AuditGuide() {
  return (
    <div className="financeauditguide" role="note">
      <strong>从一个业务编号开始</strong>
      <span>系统只查询当前授权范围，并按发生顺序关联来源事件、不可变分录、对账、结算、提现、发票、修复和审计记录。</span>
    </div>
  );
}
