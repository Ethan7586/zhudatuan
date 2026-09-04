import { Button, FilterBar, PageHeader, Pagination, ReceiptPanel, ResourceState, Watermark } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import type { ReportPeriod, ReportView } from '../model/Report';
import type { ReportingViewModel } from '../viewmodel/ReportingViewModel';
import { ReportExportDialog } from './ReportExportDialog';
import { ReportTable } from './ReportTable';
import { periodLabels, reportLabels } from './ReportingPresentation';

export function ReportingPage({ title, model }: Readonly<{ title: string; model: ReportingViewModel }>) {
  return (
    <section className="reportpage">
      <PageHeader
        eyebrow="数据决策 · 权威投影"
        title={title}
        description="商品、商城、分类、渠道与卡券消费统一使用服务端报表投影，不扫描交易主表。"
        context={
          <p className="reportcontext">
            投影版本 v{model.projectionVersion || '—'} · 时区 {model.timezone}
          </p>
        }
        actions={
          <>
            <Button onPress={model.actions.refresh}>刷新</Button>
            {model.export.allowed ? (
              <Button tone="primary" onPress={model.actions.openExport}>
                导出当前报表
              </Button>
            ) : null}
          </>
        }
      />
      <FilterBar label="报表筛选" actions={<Button onPress={model.actions.applyApplication}>应用筛选</Button>}>
        <label>
          报表
          <select value={model.view} onChange={(event) => model.actions.view(event.target.value as ReportView)}>
            {model.availableViews.map((view) => (
              <option key={view} value={view}>
                {reportLabels[view]}
              </option>
            ))}
          </select>
        </label>
        <label>
          周期
          <select value={model.period} onChange={(event) => model.actions.period(event.target.value as ReportPeriod)}>
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          应用编号
          <input value={model.applicationDraft} onChange={(event) => model.actions.application(event.target.value)} placeholder="全部应用" />
        </label>
      </FilterBar>
      {model.watermark ? <Watermark value={formatDate(model.watermark)} timezone={model.timezone} stale={model.stale} /> : null}
      <ResourceState condition={model.condition} {...(model.error ? { error: model.error } : {})} retry={model.actions.refresh}>
        <div className="reportcontent">
          <ReportTable rows={model.rows} />
          <footer>
            <span>本页 {new Intl.NumberFormat('zh-CN').format(model.count)} 条</span>
            <Pagination {...(model.nextCursor ? { next: model.nextCursor, onNext: model.actions.next } : {})} />
          </footer>
        </div>
      </ResourceState>
      {model.receipt ? (
        <div className="reportreceipt">
          <ReceiptPanel receipt={model.receipt} />
          <Button onPress={model.actions.dismissReceipt}>关闭回执</Button>
        </div>
      ) : null}
      <ReportExportDialog model={model} />
    </section>
  );
}
