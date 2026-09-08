import { MetricGrid, ResourcePanel } from '@shop/design';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { formatMinor } from '../../../shared/ui/Format';
import type { OverviewViewModel } from '../viewmodel/OverviewViewModel';
import { FinanceHeader } from './FinanceHeader';
import { FinanceTabs } from './FinanceTabs';
import { FinanceFacetSummary } from './FinanceFacetSummary';
import './FinanceWorkspace.css';

export function OverviewPage({ title, model }: Readonly<{ title: string; model: OverviewViewModel }>) {
  if (model.needsStepup) return <AssurancePrompt title={title} description="财务余额、账本与经营资金属于敏感数据。请先完成短信二次验证，成功后会自动返回并加载财务总览。" />;
  const primary = model.data?.items[0];
  const metrics = primary
    ? ([
        { id: 'balance', label: '账面余额', value: formatMinor(primary.balanceMinor, primary.currency), detail: `${primary.currency} 权威账本余额` },
        { id: 'liability', label: '负债余额', value: formatMinor(primary.liabilityMinor, primary.currency), detail: '待履约与待结算负债' },
        { id: 'income', label: '累计收入', value: formatMinor(primary.incomeMinor, primary.currency), detail: '服务端已入账收入' },
        { id: 'expense', label: '累计支出', value: formatMinor(primary.expenseMinor, primary.currency), detail: '服务端已入账支出' },
        { id: 'cash', label: '现金余额', value: formatMinor(primary.cashMinor, primary.currency), detail: '现金类科目余额' },
        { id: 'journals', label: '账务分录', value: primary.journalCount.toLocaleString('zh-CN'), detail: '不可变复式分录数量' },
      ] as const)
    : [];
  return (
    <section className="financeworkspace" aria-label="财务总览">
      <FinanceHeader title={title} overview={model.data} fetching={model.fetching} lastUpdated={model.lastUpdated} {...(model.refreshResult === undefined ? {} : { refreshResult: model.refreshResult })} onRefresh={model.refresh} />
      <FinanceTabs model={model.navigation} />
      <FinanceFacetSummary model={model} />
      <ResourcePanel title="资产与账本" description="所有金额均来自当前范围的服务端权威账本，前端不推算、不补齐。" condition={model.condition} {...errorProps(model.error)} retry={model.refresh}>
        <MetricGrid items={metrics} />
      </ResourcePanel>
    </section>
  );
}

function errorProps(error: string | undefined): Readonly<{ error?: string }> {
  return error === undefined ? {} : { error };
}
