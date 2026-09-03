import { ResourceState } from '@shop/design';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';
import { FinanceColumnSettings } from './FinanceColumnSettings';
import { FinanceHeader } from './FinanceHeader';
import { FinanceIcon } from './FinanceIcon';
import { FinanceTabs } from './FinanceTabs';
import { ReconciliationDrawer } from './ReconciliationDrawer';
import { FinancePagination, ReconciliationTable } from './ReconciliationTable';
import './FinanceWorkspace.css';
import './FinanceTable.css';
import './FinanceDrawer.css';
import './FinanceReview.css';
import './FinanceResponsive.css';

export function ReconciliationPage({ title, model }: Readonly<{ title: string; model: ReconciliationViewModel }>) {
  const error = model.error === undefined ? {} : { error: model.error };
  return (
    <section className="financeworkspace" aria-label="财务对账">
      <FinanceHeader title={title} overview={undefined} fetching={model.fetching} onRefresh={model.actions.refresh} />
      <FinanceTabs model={model.navigation} />
      <div className="financecolumnbar">
        <p><FinanceIcon name="shield" />对账金额、匹配结果和差异明细均来自服务端权威快照。</p>
        <button type="button" aria-expanded={model.columnsOpen} aria-controls="financecolumnsettings" onClick={model.actions.toggleColumns}><FinanceIcon name="settings" />列设置</button>
        <FinanceColumnSettings open={model.columnsOpen} visible={model.visibleColumns} onToggle={model.actions.toggleColumn} onClose={model.actions.closeColumns} />
      </div>
      <ResourceState condition={model.condition} {...error} retry={model.actions.refresh} emptyTitle="暂无对账批次" emptyMessage="当前范围还没有服务端对账记录。">
        {model.page === undefined ? null : <>
          <ReconciliationTable page={model.page} visible={model.visibleColumns} selected={model.selectedRows} onToggle={model.actions.toggleRow} onToggleAll={model.actions.toggleAll} onOpen={model.actions.open} />
          <FinancePagination page={model.page} limit={model.limit} hasCursor={model.cursor !== undefined} onLimit={model.actions.limit} onCursor={(cursor) => cursor ? model.actions.next(cursor) : model.actions.first()} />
        </>}
      </ResourceState>
      <ReconciliationDrawer row={model.selected} onClose={model.actions.close} />
    </section>
  );
}
