import { Button, ResourceState } from '@shop/design';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';
import { FinanceColumnSettings } from './FinanceColumnSettings';
import { FinanceHeader } from './FinanceHeader';
import { FinanceIcon } from './FinanceIcon';
import { FinanceTabs } from './FinanceTabs';
import { FinanceFilters } from './FinanceFilters';
import { ReconciliationDrawer } from './ReconciliationDrawer';
import { FinancePagination, ReconciliationTable } from './ReconciliationTable';
import './FinanceTable.css';
import './FinanceDrawer.css';
import './FinanceReview.css';
import './FinanceCommand.css';
import './FinanceWorkspace.css';

export function ReconciliationPage({ title, model }: Readonly<{ title: string; model: ReconciliationViewModel }>) {
  if (model.needsStepup) return <AssurancePrompt title={title} description="渠道账单、对账差异与处理证据属于敏感财务数据。请先完成短信二次验证，成功后会自动返回并加载对账工作台。" />;
  const error = model.error === undefined ? {} : { error: model.error };
  return (
    <section className="financeworkspace" aria-label="财务对账">
      <FinanceHeader
        title={title}
        description="核对渠道账单、系统事实与账本凭证，差异处理遵循经办、复核和重新匹配。"
        fetching={model.fetching}
        statusText={model.fetching ? '正在同步对账批次' : '服务端对账事实已同步'}
        onRefresh={model.actions.refresh}
      />
      <FinanceTabs model={model.navigation} />
      <FinanceFilters model={model} />
      <div className="financecolumnbar">
        <p>
          <FinanceIcon name="shield" />
          对账金额、匹配结果和差异明细均来自服务端权威快照。
        </p>
        <Button aria-expanded={model.columnsOpen} aria-controls="financecolumnsettings" onPress={model.actions.toggleColumns}>
          <FinanceIcon name="settings" />
          列设置
        </Button>
        <FinanceColumnSettings open={model.columnsOpen} visible={model.visibleColumns} onToggle={model.actions.toggleColumn} onClose={model.actions.closeColumns} />
      </div>
      <ResourceState condition={model.condition} {...error} retry={model.actions.refresh} emptyTitle="暂无对账批次" emptyMessage="当前范围还没有服务端对账记录。">
        {model.page === undefined ? null : (
          <>
            <ReconciliationTable page={model.page} visible={model.visibleColumns} selected={model.selectedRows} onToggle={model.actions.toggleRow} onToggleAll={model.actions.toggleAll} onOpen={model.actions.open} />
            <FinancePagination page={model.page} limit={model.limit} hasCursor={model.cursor !== undefined} onLimit={model.actions.limit} onCursor={(cursor) => (cursor ? model.actions.next(cursor) : model.actions.first())} />
          </>
        )}
      </ResourceState>
      <ReconciliationDrawer row={model.selected} item={model.selectedItem} command={model.command} actions={model.actions} onClose={model.actions.close} />
    </section>
  );
}
