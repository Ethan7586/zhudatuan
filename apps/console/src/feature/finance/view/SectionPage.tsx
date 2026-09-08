import { Button, DataTable, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { FinanceRecord, FinanceSection } from '../model/Finance';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';
import type { FinanceImportViewModel } from '../viewmodel/FinanceImportViewModel';
import { FinanceImportDialog } from './FinanceImportDialog';
import { FinanceActionDialog } from './FinanceActionDialog';
import { FinanceHeader } from './FinanceHeader';
import { FinanceRecordDrawer } from './FinanceRecordDrawer';
import { FinanceTabs } from './FinanceTabs';
import './FinanceSection.css';
import './FinanceWorkspace.css';

const metadata: Readonly<Record<FinanceSection, Readonly<{ title: string; description: string; record: string }>>> = Object.freeze({
  entries: { title: '账本分录', record: '分录', description: '核对服务端不可变借贷事实。分录只追加，前端不合计、不调账。' },
  statements: { title: '账单', record: '账单', description: '按账期查看服务端账单、余额和文件核验信息，并通过受控任务导出。' },
  reconciliations: { title: '对账', record: '批次', description: '核对服务端匹配结果、差异金额、证据与处置状态。' },
  settlements: { title: '结算', record: '结算单', description: '核对冻结结算、费用、分账和调整事实；批准与驳回执行经办复核分离。' },
  withdrawals: { title: '提现', record: '提现单', description: '查看申请、审核、渠道执行与异常恢复状态，资金结果始终以服务端为准。' },
  invoices: { title: '发票', record: '发票申请', description: '处理开票申请、审批、开具和红冲，保留来源结算与文件校验链。' },
  policies: { title: '财务治理', record: '规则', description: '集中管理财务规则、修复、期间和回补审批。' },
});

export function SectionPage({ title, model, importing }: Readonly<{ title: string; model: SectionViewModel; importing?: FinanceImportViewModel }>) {
  if (model.needsStepup) return <AssurancePrompt title={title} description="账单、对账、结算、提现和发票包含敏感财务数据。请先完成短信二次验证，成功后会自动返回并加载当前页面。" />;
  const meta = metadata[model.section];
  const columns: readonly DataColumn<FinanceRecord>[] = [
    { key: 'label', label: meta.record, render: (row) => row.label },
    { key: 'reference', label: '业务编号', render: (row) => chineseReference('业务', row.reference) },
    { key: 'amount', label: '金额', render: (row) => (row.amountMinor === null || row.currency === null ? '不适用' : formatMinor(row.amountMinor, row.currency)) },
    { key: 'state', label: '状态', render: (row) => chineseDomainLabel(row.state) },
    { key: 'time', label: '业务时间', render: (row) => formatDate(row.occurredAt) },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <Button tone="quiet" onPress={() => model.actions.open(row.id)}>
          查看详情
        </Button>
      ),
    },
  ];
  const summary = [
    { label: '服务端总数', value: (model.data?.count ?? 0).toLocaleString('zh-CN') },
    { label: '当前页', value: `${model.data?.items.length ?? 0} 条` },
    { label: '筛选结果', value: `${model.rows.length} 条` },
    { label: '状态筛选', value: model.status ? chineseDomainLabel(model.status) : '全部' },
  ];
  return (
    <section className="financeworkspace financesectionworkspace">
      <FinanceHeader
        title={title}
        description={meta.description}
        summary={summary}
        fetching={model.condition === 'refreshing'}
        statusText={model.condition === 'refreshing' ? '正在同步服务端当前页' : '服务端游标分页 · 当前页已同步'}
        onRefresh={model.refresh}
      />
      <FinanceTabs model={model.navigation} {...(importing === undefined ? {} : { onImport: importing.actions.open })} />
      <div className="financesectiontoolbar">
        <label>
          筛选本页状态
          <select value={model.status ?? ''} onChange={(event) => model.actions.filter(event.target.value)}>
            <option value="">全部状态</option>
            {model.states.map((state) => (
              <option key={state} value={state}>
                {chineseDomainLabel(state)}
              </option>
            ))}
          </select>
        </label>
        <span>筛选仅作用于当前已读取页，翻页仍由服务端游标控制。</span>
      </div>
      {model.receipt ? (
        <div className="financesectionreceipt">
          <ActionReceipt state={{ kind: 'success', receipt: model.receipt, objectLabel: meta.record, impact: '服务端已受理并完成权威回读，列表与详情已同步。' }} dismiss={{ label: '关闭回执', onPress: model.actions.dismissReceipt }} />
        </div>
      ) : null}
      <ResourcePanel
        headingLevel={2}
        title={meta.title}
        eyebrow="财务权威数据"
        description={meta.description}
        condition={model.condition}
        {...(model.error === undefined ? {} : { error: model.error })}
        retry={model.refresh}
        actions={
          <>
            {model.globalActions.map((action) => (
              <Button key={action.kind} tone="primary" onPress={() => model.actions.begin(action)}>
                {action.label}
              </Button>
            ))}
            <Button onPress={model.refresh}>刷新</Button>
          </>
        }
      >
        {model.rows.length === 0 && model.status ? (
          <div className="financelocalempty">
            <strong>当前页没有符合条件的记录</strong>
            <p>可切换状态，或翻页继续查看服务端数据。</p>
          </div>
        ) : (
          <DataTable caption={meta.title} columns={columns} rows={model.rows} rowKey={(row) => row.id} />
        )}
        <div className="financepagination">
          <span>服务端共 {model.data?.count ?? 0} 条</span>
          <span>当前显示 {model.rows.length} 条</span>
          <Button onPress={() => model.data?.nextCursor && model.next(model.data.nextCursor)} isDisabled={model.data?.nextCursor === undefined}>
            下一页
          </Button>
        </div>
      </ResourcePanel>
      <FinanceRecordDrawer model={model} />
      <FinanceActionDialog model={model} />
      {importing === undefined ? null : <FinanceImportDialog model={importing} />}
    </section>
  );
}
