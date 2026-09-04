import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import { voucherRecordOperations } from '../model/VoucherAction';
import { voucherOperationMeta } from '../model/VoucherOperationCatalog';
import type { VoucherViewModel } from '../viewmodel/VoucherViewModel';
import { VoucherCommandDialog } from './VoucherCommandDialog';
import { VoucherDrawer } from './VoucherDrawer';
import { voucherLifecycle, voucherStateLabel, voucherViewMeta } from './VoucherPresentation';
import { VoucherTable } from './VoucherTable';

export function VoucherPage({ model }: Readonly<{ model: VoucherViewModel }>) {
  const drawerOperations = voucherRecordOperations(model.selectedRecord).filter(model.can);
  return <div className="voucherworkspace" data-view={model.view}>
    <ResourcePanel title="卡券中心" eyebrow={chineseSectionLabel('卡券治理')} description="从卡券产品、卡号库和安全凭证，到库存审批、发放、持有、核销、退款与批量操作的完整工作台。" condition={model.condition} {...(model.error ? { error: model.error } : {})} retry={model.actions.refresh} actions={<PrimaryActions model={model} />}>
      <div className="vouchercontent">
        {model.receipt ? <section className="voucherreceipt" role="status"><strong>操作已受理</strong><p>{model.receipt}</p>{model.progressPending ? <small>正在读取后台任务进度…</small> : null}{model.progress ? <Progress progress={model.progress} /> : null}{model.progressError ? <small>{model.progressError}</small> : null}<Button onPress={model.actions.dismissReceipt}>知道了</Button></section> : null}
        <section className="voucherownership" role="note"><span aria-hidden="true">域</span><div><strong>当前网站归属：{model.scopeName}</strong><p>读取、审批、发放和核销全部按当前范围隔离；客户、成员和资格信息引用各自权威模块。</p></div></section>
        <section className="vouchersummary" aria-label="当前卡券读模型摘要">{model.summary.map((metric) => <article key={metric.label} className={`is-${metric.tone}`}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small></article>)}</section>
        <ol className="voucherlifecycle" aria-label="卡券生命周期">{voucherLifecycle.map((item, index) => <li key={item.key} className={`is-${item.key}`}><span>{index + 1}</span><div><strong>{item.label}</strong><small>{item.role}</small></div></li>)}</ol>
        <section className="voucherboard" aria-labelledby="voucherviewtitle">
          <nav className="vouchertabs" aria-label="卡券数据视图">{model.availableViews.map((candidate) => <button key={candidate} type="button" aria-pressed={candidate === model.view} onClick={() => model.actions.selectView(candidate)}>{voucherViewMeta[candidate].label}{candidate === model.view && model.data ? <span>{model.data.count}</span> : null}</button>)}</nav>
          <div className="voucherfilterbar"><div className="voucherfiltercopy"><strong id="voucherviewtitle">{voucherViewMeta[model.view].label}</strong><span>{voucherViewMeta[model.view].description}</span></div><label className="vouchersearch"><span className="sr-only">搜索当前卡券视图</span><input type="search" value={model.queryText} onChange={(event) => model.actions.filter('q', event.target.value)} placeholder={voucherViewMeta[model.view].search} /></label><label className="voucherstatusfilter"><span className="sr-only">按状态筛选</span><select value={model.status} onChange={(event) => model.actions.filter('status', event.target.value)}><option value="all">全部状态</option>{model.states.map((state) => <option key={state} value={state}>{voucherStateLabel(state)}</option>)}</select></label></div>
          {model.facets ? <section className="voucherfacets" aria-label="服务端筛选统计"><strong>状态分布</strong><button type="button" aria-pressed={model.status === 'all'} onClick={() => model.actions.filter('status', 'all')}>全部</button>{model.facets.states.map((facet) => <button key={facet.value} type="button" aria-pressed={model.status === facet.value} onClick={() => model.actions.filter('status', facet.value)}>{voucherStateLabel(facet.value)} <span>{facet.count}</span></button>)}<small>统计水位 {new Date(model.facets.watermark).toLocaleString('zh-CN')}</small></section> : model.facetPending ? <p className="voucherfiltermeta">正在读取服务端筛选统计…</p> : null}
          {(model.view === 'vouchers' || model.view === 'search') && model.exactAvailable ? <section className="voucherexact"><div><strong>完整券号精准查询</strong><span>完整券号不会写入地址栏；服务端统一脱敏返回。</span></div><input aria-label="完整券号" type="password" autoComplete="off" value={model.numberInput} onChange={(event) => model.actions.numberInput(event.target.value)} /><Button onPress={model.actions.lookup} isDisabled={!model.numberInput.trim() || model.exactPending}>{model.exactPending ? '查询中…' : '精准查询'}</Button>{model.exactError ? <p role="alert">{model.exactError}</p> : null}{model.exactRecord ? <button aria-label={`打开精准查询结果 ${model.exactRecord.name}`} className="voucherexactresult" type="button" onClick={() => model.actions.open(model.exactRecord!)}><strong>{model.exactRecord.name}</strong><span>{model.exactRecord.detail} · {voucherStateLabel(model.exactRecord.state)}</span></button> : null}</section> : null}
          <p className="voucherfiltermeta">显示 {model.rows.length} / {model.data?.items.length ?? 0} 条 · 服务端范围过滤与游标分页</p>
          {model.view === 'redemptions' && !model.queryText.trim() ? <Empty title="输入核销回执编号" detail="为保护消费者数据，核销记录不做无条件全量枚举；输入完整回执编号后读取。" /> : null}
          {model.data && model.data.items.length === 0 && !(model.view === 'redemptions' && !model.queryText.trim()) ? <Empty title={`暂无${voucherViewMeta[model.view].label}记录`} detail="可使用上方已授权操作创建第一条记录，或切换其他视图。" /> : null}
          {model.data && model.data.items.length > 0 && model.rows.length === 0 ? <section className="voucherfilteredempty" role="status"><strong>当前页没有匹配记录</strong><p>调整搜索词或状态即可恢复列表。</p><button type="button" onClick={model.actions.clearFilters}>清除筛选</button></section> : null}
          {model.rows.length ? <VoucherTable rows={model.rows} view={model.view} onOpen={model.actions.open} /> : null}
          <footer className="voucherpagination"><span>当前游标页 {model.data?.count ?? 0} 条</span><Button onPress={model.actions.next} isDisabled={!model.data?.nextCursor}>下一页</Button></footer>
        </section>
      </div>
    </ResourcePanel>
    <VoucherDrawer {...(model.selectedRecord ? { record: model.selectedRecord } : {})} view={model.view} operations={drawerOperations} pending={model.detailPending} {...(model.timeline ? { timeline: model.timeline } : {})} timelinePending={model.timelinePending} {...(model.timelineError ? { timelineError: model.timelineError } : {})} {...(model.relatedProgress ? { progress: model.relatedProgress } : {})} onAction={model.actions.start} onClose={model.actions.close} />
    <VoucherCommandDialog action={model.action} busy={model.actionBusy} choices={model.choices} choiceBusy={model.choiceBusy} {...(model.choiceError ? { choiceError: model.choiceError } : {})} {...(model.actionError ? { remoteError: model.actionError } : {})} onSubmit={model.actions.submit} onClose={model.actions.closeAction} />
  </div>;
}

function PrimaryActions({ model }: Readonly<{ model: VoucherViewModel }>) { return <>{model.needsStepup ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}{model.primaryOperations.map((operation, index) => <Button key={operation} tone={index === 0 ? 'primary' : 'default'} onPress={() => model.actions.start(operation)}>{voucherOperationMeta(operation).label}</Button>)}<Button onPress={model.actions.refresh}>刷新数据</Button></>; }
function Empty({ title, detail }: Readonly<{ title: string; detail: string }>) { return <section className="voucherfilteredempty" role="status"><strong>{title}</strong><p>{detail}</p></section>; }

function Progress({ progress }: Readonly<{ progress: NonNullable<VoucherViewModel['progress']> }>) {
  const ratio = progress.total > 0 ? Math.min(100, Math.round(progress.processed / progress.total * 100)) : 0;
  return <section className="voucherprogress" aria-label="后台任务进度"><div><span>{progress.kind === 'export' ? '安全导出' : progress.kind === 'job' ? '凭证任务' : progress.kind === 'issue' ? '发放批次' : '批量操作'} · {voucherStateLabel(progress.state)}</span><strong>{ratio}%</strong></div><progress max={100} value={ratio}>{ratio}%</progress><small>已处理 {progress.processed} / {progress.total} · 成功 {progress.succeeded} · 失败 {progress.failed}{progress.retryable ? ` · 可重试 ${progress.retryable}` : ''}</small>{progress.fileName ? <small>安全文件：{progress.fileName}；下载凭证不会显示或写入地址栏。</small> : null}</section>;
}
