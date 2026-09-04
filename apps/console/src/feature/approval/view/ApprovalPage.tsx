import { Button, DataTable, MetricGrid, ResourcePanel, Status, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { formatDate } from '../../../shared/ui/Format';
import type { ApprovalTask, ApprovalTemplate, ApprovalTemplateVersion } from '../model/Approval';
import { ApprovalPanel } from '../public/ApprovalPanel';
import type { ApprovalViewModel } from '../viewmodel/ApprovalViewModel';
import { ApprovalDialog } from './ApprovalDialog';
import './Approval.css';

export function ApprovalPage({ title, model }: Readonly<{ title: string; model: ApprovalViewModel }>) {
  const resource = model.page;
  return (
    <div className="approvalpage">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('审批治理')}
        description="审批模板、待办任务、实例证据和决定结果均来自权威审批服务；写入携带稳定幂等键与目标版本。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="approvalactions">
            {model.assurance < 2 ? <Button tone="primary" onPress={model.actions.stepup}>完成二次验证</Button> : null}
            {resource?.kind !== 'template' ? (
              <>
                <Button {...(model.view === 'templates' ? { tone: 'primary' as const } : {})} onPress={() => model.actions.setView('templates')}>审批规则</Button>
                <Button {...(model.view === 'tasks' ? { tone: 'primary' as const } : {})} onPress={() => model.actions.setView('tasks')}>我的待办</Button>
              </>
            ) : <Button onPress={model.actions.closeTemplate}>返回规则列表</Button>}
            {model.capabilities.create && model.view === 'templates' && resource?.kind !== 'template' ? <Button tone="primary" onPress={model.actions.create}>新建规则</Button> : null}
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>{model.fetching ? '正在刷新…' : '刷新'}</Button>
          </div>
        }
        notice={
          <section className="approvalnotice">
            <strong>{model.assurance >= 2 ? '敏感审批数据已解锁' : '审批数据需要二次验证'}</strong>
            <p>{model.assurance >= 2 ? '启用、停用、修订和决定仍会按各自 Operation 再校验权限、验证等级和并发版本。' : '完成验证后才会发起查询，避免敏感审批对象在低验证会话中短暂显示。'}</p>
          </section>
        }
      >
        {resource?.kind === 'templates' ? <TemplateList model={model} rows={resource.items} /> : null}
        {resource?.kind === 'tasks' ? <TaskList model={model} rows={resource.items} /> : null}
        {resource?.kind === 'template' ? <TemplateDetail model={model} template={resource.template} versions={resource.versions} /> : null}
      </ResourcePanel>
      {model.instanceOpen ? (
        <ResourcePanel
          eyebrow="审批实例"
          title={model.instance ? chineseReference('审批实例', model.instance.id) : '正在读取审批实例'}
          description="审批对象、步骤和决定证据独立加载，失败不会影响规则或待办列表。"
          condition={model.instanceCondition}
          {...(model.instanceError ? { error: model.instanceError } : {})}
          retry={model.actions.retryInstance}
          actions={<Button onPress={model.actions.closeInstance}>关闭实例详情</Button>}
        >
          {model.instance ? (
            <ApprovalPanel instance={model.instance} subjectLabel={model.subjectLabel(model.instance.subjectKind)} />
          ) : null}
        </ResourcePanel>
      ) : null}
      {model.receipt ? <ActionReceipt state={{ kind: 'success', receipt: model.receipt, objectLabel: '审批对象', impact: '审批结果已权威回读；需要最终落地的变更仍由所属业务模块执行。' }} dismiss={{ label: '收起回执', onPress: model.actions.dismissReceipt }} /> : null}
      <ApprovalDialog model={model} />
    </div>
  );
}

function TemplateList({ model, rows }: Readonly<{ model: ApprovalViewModel; rows: readonly ApprovalTemplate[] }>) {
  const columns: readonly DataColumn<ApprovalTemplate>[] = [
    { key: 'name', label: '规则', render: (row) => <button className="approvallink" onClick={() => model.actions.openTemplate(row)}>{row.name}</button> },
    { key: 'code', label: '规则编码', render: (row) => row.code },
    { key: 'subject', label: '适用业务', render: (row) => model.subjectLabel(row.subjectKind) },
    { key: 'state', label: '状态', render: (row) => <Status tone={row.state === 'enabled' ? 'success' : row.state === 'draft' ? 'warning' : 'neutral'}>{statusText(row.state)}</Status> },
    { key: 'version', label: '版本', render: (row) => `v${row.version}${row.activeVersion === null ? '' : ` · 生效版 ${row.activeVersion}`}` },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    ...(model.capabilities.revise || model.capabilities.enable || model.capabilities.disable ? [{ key: 'actions', label: '操作', render: (row: ApprovalTemplate) => <TemplateActions model={model} template={row} /> } satisfies DataColumn<ApprovalTemplate>] : []),
  ];
  return <ListBody model={model} stateOptions={[['draft', '草稿'], ['enabled', '已启用'], ['disabled', '已停用']]}><DataTable caption="审批规则" rows={rows} columns={columns} rowKey={(row) => row.id} /></ListBody>;
}

function TaskList({ model, rows }: Readonly<{ model: ApprovalViewModel; rows: readonly ApprovalTask[] }>) {
  const columns: readonly DataColumn<ApprovalTask>[] = [
    { key: 'name', label: '待办', render: (row) => row.name },
    { key: 'instance', label: '业务审批', render: (row) => <button className="approvallink" onClick={() => model.actions.openInstance(row.instanceId)}>{chineseReference('审批实例', row.instanceId)}</button> },
    { key: 'assignee', label: '指派条件', render: (row) => `${assigneeText(row.assigneeKind)} · ${row.assignee}` },
    { key: 'progress', label: '同意进度', render: (row) => `${row.approvalCount} / ${row.minimumApprovals}` },
    { key: 'state', label: '状态', render: (row) => <Status tone={row.state === 'approved' ? 'success' : row.state === 'rejected' || row.state === 'expired' ? 'danger' : 'warning'}>{statusText(row.state)}</Status> },
    { key: 'due', label: '处理期限', render: (row) => formatDate(row.dueAt) },
    ...(model.capabilities.approve || model.capabilities.reject ? [{ key: 'actions', label: '决定', render: (row: ApprovalTask) => row.state === 'pending' || row.state === 'escalated' ? <div className="approvalactions">{model.capabilities.approve ? <Button tone="primary" onPress={() => model.actions.approve(row)}>批准</Button> : null}{model.capabilities.reject ? <Button tone="danger" onPress={() => model.actions.reject(row)}>拒绝</Button> : null}</div> : '已处理' } satisfies DataColumn<ApprovalTask>] : []),
  ];
  return <ListBody model={model} stateOptions={[['pending', '待处理'], ['escalated', '已升级'], ['approved', '已批准'], ['rejected', '已拒绝'], ['expired', '已过期'], ['cancelled', '已取消']]}><DataTable caption="审批待办" rows={rows} columns={columns} rowKey={(row) => row.id} /></ListBody>;
}

function ListBody({ model, stateOptions, children }: Readonly<{ model: ApprovalViewModel; stateOptions: readonly (readonly [string, string])[]; children: React.ReactNode }>) {
  const page = model.page?.kind === 'templates' || model.page?.kind === 'tasks' ? model.page : undefined;
  return <div className="approvalstack">
    <div className="approvalfilters" aria-label="审批筛选">
      <label>状态<select value={model.state ?? ''} onChange={(event) => model.actions.state(event.target.value)}><option value="">全部状态</option>{stateOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>适用业务<select value={model.subjectKind ?? ''} onChange={(event) => model.actions.subject(event.target.value)}><option value="">全部业务</option>{model.subjects.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {children}
    <footer className="approvalpagination"><span>本页 {page?.count ?? 0} 条</span><div>{model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}{page?.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}</div></footer>
  </div>;
}

function TemplateDetail({ model, template, versions }: Readonly<{ model: ApprovalViewModel; template: ApprovalTemplate; versions: readonly ApprovalTemplateVersion[] }>) {
  const latest = versions.reduce<ApprovalTemplateVersion | undefined>((current, version) => current === undefined || version.number > current.number ? version : current, undefined);
  const columns: readonly DataColumn<ApprovalTemplateVersion>[] = [
    { key: 'version', label: '版本', render: (row) => `第 ${row.number} 版` },
    { key: 'name', label: '规则名称', render: (row) => row.name },
    { key: 'steps', label: '审批步骤', render: (row) => row.steps.map((step) => `${step.sequence}. ${step.name}（${step.dueHours} 小时）`).join('；') },
    { key: 'escalation', label: '超时升级', render: (row) => row.escalations.length ? row.escalations.map((item) => `${item.afterHours} 小时后${item.action === 'notify' ? '提醒' : item.action === 'reassign' ? `转交 ${item.target ?? '指定审批人'}` : '自动拒绝'}`).join('；') : '无' },
    { key: 'created', label: '创建时间', render: (row) => formatDate(row.createdAt) },
  ];
  return <div className="approvalstack">
    <MetricGrid items={[{ label: '当前状态', value: statusText(template.state), tone: template.state === 'enabled' ? 'success' : 'warning' }, { label: '适用业务', value: model.subjectLabel(template.subjectKind) }, { label: '聚合版本', value: `v${template.version}` }, { label: '生效版本', value: template.activeVersion === null ? '尚未启用' : `第 ${template.activeVersion} 版` }]} />
    {latest ? <TemplateActions model={model} template={template} version={latest} /> : null}
    <DataTable caption="规则版本历史" rows={versions} columns={columns} rowKey={(row) => row.id} />
  </div>;
}

function TemplateActions({ model, template, version }: Readonly<{ model: ApprovalViewModel; template: ApprovalTemplate; version?: ApprovalTemplateVersion }>) {
  return <div className="approvalactions">{version && model.capabilities.revise ? <Button onPress={() => model.actions.revise(template, version)}>修订</Button> : !version ? <Button onPress={() => model.actions.openTemplate(template)}>查看详情</Button> : null}{template.state === 'enabled' && model.capabilities.disable ? <Button tone="danger" onPress={() => model.actions.disable(template)}>停用</Button> : template.state !== 'enabled' && model.capabilities.enable ? <Button tone="primary" onPress={() => model.actions.enable(template)}>启用</Button> : null}</div>;
}

function statusText(value: string): string {
  return ({ draft: '草稿', enabled: '已启用', disabled: '已停用', pending: '待处理', approved: '已批准', rejected: '已拒绝', cancelled: '已取消', expired: '已过期', escalated: '已升级' } as Readonly<Record<string, string>>)[value] ?? chineseDomainLabel(value);
}
function assigneeText(value: string): string {
  return value === 'permission' ? '权限' : value === 'role' ? '角色' : '指定成员';
}
