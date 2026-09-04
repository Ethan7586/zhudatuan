import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { VoucherRecord } from '../model/Voucher';
import type { VoucherViewModel } from '../viewmodel/VoucherViewModel';
import { VoucherDialogs } from './VoucherDialogs';
import { VoucherDrawer, type VoucherDrawerAction } from './VoucherDrawer';
import { voucherLifecycle, voucherStateLabel, voucherViewMeta } from './VoucherPresentation';
import { VoucherTable } from './VoucherTable';

export function VoucherPage({ model }: Readonly<{ model: VoucherViewModel }>) {
  const recordActions = drawerActions(model, model.selectedRecord);
  return (
    <div className="voucherworkspace" data-view={model.view}>
      <ResourcePanel
        title="卡券中心"
        eyebrow={chineseSectionLabel('卡券治理')}
        description="管理卡券方案、卡号资产、备券审批、发行、状态批次、绑定与消费回执。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={<PrimaryActions model={model} />}
      >
        <div className="vouchercontent">
          {model.receipt ? (
            <section className="voucherreceipt" role="status">
              <strong>操作已提交</strong>
              <p>{model.receipt}</p>
              <Button onPress={model.actions.dismissReceipt}>知道了</Button>
            </section>
          ) : null}
          <section className="voucherownership" role="note">
            <span aria-hidden="true">域</span>
            <div>
              <strong>当前网站归属：{model.scopeName}</strong>
              <p>所有列表和写操作按当前管理范围隔离；待确认的客户管理与产品档案不在本页面创建。</p>
            </div>
          </section>
          <section className="vouchersummary" aria-label="当前卡券读模型摘要">
            {model.summary.map((metric) => (
              <article key={metric.label} className={`is-${metric.tone}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </article>
            ))}
          </section>
          <ol className="voucherlifecycle" aria-label="卡券生命周期">
            {voucherLifecycle.map((item, index) => (
              <li key={item.key} className={`is-${item.key}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.role}</small>
                </div>
              </li>
            ))}
          </ol>
          <section className="voucherboard" aria-labelledby="voucherviewtitle">
            <nav className="vouchertabs" aria-label="卡券数据视图">
              {model.availableViews.map((candidate) => (
                <button key={candidate} type="button" aria-pressed={candidate === model.view} onClick={() => model.actions.selectView(candidate)}>
                  {voucherViewMeta[candidate].label}
                  {candidate === model.view && model.data ? <span>{model.data.count}</span> : null}
                </button>
              ))}
            </nav>
            <div className="voucherfilterbar">
              <div className="voucherfiltercopy">
                <strong id="voucherviewtitle">{voucherViewMeta[model.view].label}</strong>
                <span>{voucherViewMeta[model.view].description}</span>
              </div>
              <label className="vouchersearch">
                <span className="sr-only">搜索当前卡券视图</span>
                <input type="search" value={model.queryText} onChange={(event) => model.actions.filter('q', event.target.value)} placeholder="搜索名称、编号或详情" />
              </label>
              <label className="voucherstatusfilter">
                <span className="sr-only">按状态筛选</span>
                <select value={model.status} onChange={(event) => model.actions.filter('status', event.target.value)}>
                  <option value="all">全部状态</option>
                  {model.states.map((state) => (
                    <option key={state} value={state}>
                      {voucherStateLabel(state)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="voucherfiltermeta">
              当前页筛选 · 显示 {model.rows.length} / {model.data?.items.length ?? 0} 条 · 服务端游标分页
            </p>
            {model.data && model.data.items.length === 0 ? (
              <section className="voucherfilteredempty" role="status">
                <strong>暂无{voucherViewMeta[model.view].label}记录</strong>
                <p>可使用页面上方已授权操作创建第一条记录，或切换其他视图。</p>
              </section>
            ) : null}
            {model.data && model.data.items.length > 0 && model.rows.length === 0 ? (
              <section className="voucherfilteredempty" role="status">
                <strong>当前页没有匹配记录</strong>
                <p>调整搜索词或状态即可恢复列表。</p>
                <button type="button" onClick={model.actions.clearFilters}>
                  清除筛选
                </button>
              </section>
            ) : null}
            {model.rows.length ? <VoucherTable rows={model.rows} view={model.view} selected={model.selected} onOpen={model.actions.open} onSelect={model.actions.choose} /> : null}
            <footer className="voucherpagination">
              <span>本页 {model.data?.count ?? 0} 条 · 游标分页</span>
              <Button onPress={model.actions.next} isDisabled={!model.data?.nextCursor}>
                下一页
              </Button>
            </footer>
          </section>
        </div>
      </ResourcePanel>
      <VoucherDrawer {...(model.selectedRecord ? { record: model.selectedRecord } : {})} view={model.view} actions={recordActions} onClose={model.actions.close} />
      <VoucherDialogs model={model.action} onClose={model.actions.closeAction} />
    </div>
  );
}

function PrimaryActions({ model }: Readonly<{ model: VoucherViewModel }>) {
  return (
    <>
      {model.permissions.saveProgram ? (
        <Button tone="primary" onPress={() => model.actions.start({ kind: 'createprogram' })}>
          新建卡券
        </Button>
      ) : null}
      {model.permissions.createLibrary ? <Button onPress={() => model.actions.start({ kind: 'createlibrary' })}>新建卡号库</Button> : null}
      {model.permissions.requestReserve ? <Button onPress={() => model.actions.start({ kind: 'requestreserve' })}>申请备券</Button> : null}
      {model.permissions.issueBatch ? <Button onPress={() => model.actions.start({ kind: 'issuebatch' })}>发行卡券</Button> : null}
      {model.permissions.changeStatus && model.view === 'bindings' ? <Button onPress={model.actions.choosePage}>选择本页</Button> : null}
      {model.permissions.changeStatus && model.view === 'bindings' && model.selectedRows.length ? (
        <Button tone="danger" onPress={model.actions.changeSelected}>
          批量操作（{model.selectedRows.length}）
        </Button>
      ) : null}
      <Button onPress={model.actions.refresh}>刷新数据</Button>
    </>
  );
}

function drawerActions(model: VoucherViewModel, record?: VoucherRecord): readonly VoucherDrawerAction[] {
  if (!record) return [];
  const actions: VoucherDrawerAction[] = [];
  if (record.kind === 'programs' && model.permissions.saveProgram) actions.push({ label: '编辑方案', tone: 'primary', run: () => model.actions.start({ kind: 'editprogram', record }) });
  if (record.kind === 'libraries' && model.permissions.allocateLibrary) actions.push({ label: '分配额度', tone: 'primary', run: () => model.actions.start({ kind: 'allocatelibrary', record }) });
  if (record.kind === 'reserves' && record.state === 'submitted' && model.permissions.decideReserve) actions.push({ label: '审批申请', tone: 'primary', run: () => model.actions.start({ kind: 'decidereserve', record }) });
  if (record.kind === 'batches' && record.state === 'failed' && model.permissions.retryBatch) actions.push({ label: '重试发行', tone: 'danger', run: () => model.actions.start({ kind: 'retrybatch', record }) });
  if (record.kind === 'bindings' && !record.memberId && model.permissions.bind) actions.push({ label: '绑定成员', tone: 'primary', run: () => model.actions.start({ kind: 'bind', record }) });
  if (record.kind === 'redemptions' && record.state !== 'reversed' && model.permissions.reverse) actions.push({ label: '冲正消费', tone: 'danger', run: () => model.actions.start({ kind: 'reverse', record }) });
  return Object.freeze(actions);
}
