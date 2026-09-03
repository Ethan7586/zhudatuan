import { Button, ResourcePanel } from '@shop/design';
import type { ApplicationViewModel } from '../viewmodel/ApplicationViewModel';
import type { CommerceWorkspaceMode } from '../model/ExperienceScope';
import { EntryDialog } from './EntryDialog';
import { ExperienceActionDialog } from './ExperienceActionDialog';
import { ExperienceRecordDrawer } from './ExperienceRecordDrawer';
import { ExperienceTable } from './ExperienceTable';

export function ExperiencePage({ title, model }: Readonly<{ title: string; model: ApplicationViewModel }>) {
  const primaryDisabled = model.presentation.mode === 'management' ? !model.permissions.create : model.presentation.mode === 'design' ? !model.permissions.publish || model.rows.length === 0 : model.rows.length === 0;
  const primary = () => {
    if (model.presentation.mode === 'management') model.action.actions.open({ kind: 'create' });
    else if (model.presentation.mode === 'design' && model.rows[0]) model.action.actions.open({ kind: 'design', record: model.rows[0] });
    else if (model.rows[0]) model.actions.openRecord(model.rows[0]);
  };
  return <div className="commerceworkspace" data-mode={model.presentation.mode}>
    <ResourcePanel title={title} eyebrow={model.presentation.eyebrow} description={model.presentation.description} condition={model.condition} {...(model.error === undefined ? {} : { error: model.error })} retry={model.actions.refresh} actions={<><Button onPress={model.actions.refresh}>刷新数据</Button><Button tone="primary" onPress={primary} isDisabled={primaryDisabled}>{model.presentation.primaryAction}</Button></>}>
      <div className="commercecontent">
        <section className="commerceownership" role="note"><span className="commerceownershipicon" aria-hidden="true">域</span><div><strong>{model.presentation.ownership}：{model.scopeName}</strong><p>{model.presentation.ownershipDetail}</p></div><span className="commerceversionrule">装修呈现以当前已发布版本为准</span></section>
        <section className="commercesummary" aria-label="商城与应用读模型摘要">{model.summary.map((metric) => <article key={metric.label} className={`is-${metric.tone}`}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small></article>)}</section>
        <section className="commerceboundarybanner" role="note"><span className="commerceboundaryicon" aria-hidden="true">!</span><div><strong>{model.presentation.mode === 'management' ? '商城创建与初始草稿已启用' : '装修版本链已启用'}</strong><p>{boundaryMessage(model.presentation.mode)}</p></div></section>
        <ol className="commerceflow" aria-label={`${model.presentation.title}业务闭环`}>{model.flow.map((step, index) => <li key={step.label}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}</ol>
        <section className="commerceboard" aria-labelledby="commerceboardtitle">
          <nav className="commercetabs" aria-label="商城与应用状态视图">{model.views.map((candidate) => <button key={candidate.key} type="button" aria-pressed={candidate.key === model.view} onClick={() => model.actions.selectView(candidate.key)}>{candidate.label}</button>)}</nav>
          <div className="commercefilterbar"><div><strong id="commerceboardtitle">商城应用清单</strong><span>应用、入口、草稿、校验与发布状态来自同一权威读模型</span></div><label className="commercesearch"><span className="sr-only">搜索商城应用</span><input type="search" value={model.search} onChange={(event) => model.actions.search(event.target.value)} placeholder="搜索名称、代码、商城或公开链接" /></label></div>
          <p className="commercefiltermeta">当前页筛选 · 显示 {model.rows.length} / {model.data?.items.length ?? 0} 条 · 不推断未返回的商城总量</p>
          {model.data !== undefined && model.data.items.length === 0 ? <section className="commerceempty" role="status"><strong>当前范围暂无商城应用</strong><p>{model.presentation.mode === 'management' ? '点击创建商城，原子建立应用、初始装修草稿和商城商品池绑定。' : '当前商城暂无应用，请先从集团范围创建。'}</p></section> : null}
          {model.data !== undefined && model.data.items.length > 0 && model.rows.length === 0 ? <section className="commerceempty" role="status"><strong>当前页没有匹配记录</strong><p>调整状态视图或搜索词即可恢复列表。</p><button type="button" onClick={model.actions.clearFilters}>清除筛选</button></section> : null}
          {model.rows.length === 0 ? null : <ExperienceTable rows={model.rows} mode={model.presentation.mode} permissions={model.permissions} onOpen={model.actions.openRecord} onManage={(record) => model.action.actions.open({ kind: 'manage', record })} onEntry={model.entry.actions.open} onCopy={(record) => model.action.actions.open({ kind: 'copy', record })} onDesign={(record) => model.action.actions.open({ kind: 'design', record })} />}
          <footer className="commercepagination"><span>服务端返回 {model.data?.count ?? 0} 条 · 游标分页</span><Button onPress={model.actions.nextPage} isDisabled={model.data?.nextCursor === undefined}>下一页</Button></footer>
        </section>
      </div>
    </ResourcePanel>
    <ExperienceRecordDrawer record={model.selected} model={model.detail} onClose={model.actions.closeRecord} />
    <EntryDialog record={model.entry.record} onClose={model.entry.actions.close} />
    <ExperienceActionDialog application={model.action} version={model.version} />
  </div>;
}

function boundaryMessage(mode: CommerceWorkspaceMode): string {
  if (mode === 'management') return '服务端在一个事务中建立独立商城、应用、初始草稿与专属商品池，失败时整体回滚。';
  if (mode === 'design') return '保存、校验、发布与恢复均使用独立受控操作和版本校验，失败版本不会污染已发布版本。';
  return '平台可查看准入与异常，但正式审批必须进入系统治理并与商户权限隔离。';
}
