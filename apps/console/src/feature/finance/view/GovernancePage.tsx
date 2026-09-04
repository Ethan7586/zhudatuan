import { Button, DataTable, ResourcePanel, Status, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { FinancePolicy, FinanceRepair } from '../model/FinanceGovernance';
import type { PolicyViewModel } from '../viewmodel/PolicyViewModel';
import { FinanceHeader } from './FinanceHeader';
import { FinanceTabs } from './FinanceTabs';
import { PolicyDialog } from './PolicyDialog';
import { RepairDialog } from './RepairDialog';
import './FinanceWorkspace.css';
import './FinanceGovernance.css';

export function GovernancePage({ title, model }: Readonly<{ title: string; model: PolicyViewModel }>) {
  const page = model.view === 'policies' ? model.policies : model.repairs;
  return (
    <section className="financeworkspace governanceworkspace">
      <FinanceHeader
        title={title}
        description="统一管理会计政策与对账修复；预览不落账，变更经过验证、复核、幂等执行和权威回读。"
        summary={[
          { label: model.view === 'policies' ? '政策总数' : '修复总数', value: (page?.count ?? 0).toLocaleString('zh-CN') },
          { label: '当前页', value: `${page?.items.length ?? 0} 条` },
          { label: '治理模式', value: model.view === 'policies' ? '政策规则' : '对账修复' },
          { label: '身份验证', value: model.assurance >= 3 ? '高强度' : '需提升' },
        ]}
        fetching={model.fetching}
        statusText="服务端游标分页 · 每项操作独立校验"
        onRefresh={model.actions.refresh}
      />
      <FinanceTabs model={model.navigation} />
      <nav className="governanceswitch" aria-label="财务治理分类">
        <button type="button" aria-label="政策规则" aria-current={model.view === 'policies' ? 'page' : undefined} onClick={() => model.actions.view('policies')}><strong>政策规则</strong><span>定义何时、如何生成平衡分录</span></button>
        <button type="button" aria-label="对账修复" aria-current={model.view === 'repairs' ? 'page' : undefined} onClick={() => model.actions.view('repairs')}><strong>对账修复</strong><span>按经办、复核分离处理账单差异</span></button>
      </nav>
      {model.receipt ? <div className="governancereceipt"><ActionReceipt state={{ kind: 'success', receipt: model.receipt, objectLabel: model.view === 'policies' ? '财务政策' : '对账修复', impact: '结果已从权威服务回读；历史账本与审批证据保持可追溯。' }} dismiss={{ label: '关闭回执', onPress: model.actions.dismissReceipt }} /></div> : null}
      <ResourcePanel
        headingLevel={2}
        eyebrow="财务权威治理数据"
        title={model.view === 'policies' ? '财务政策' : '对账修复'}
        description={model.view === 'policies' ? '政策变更先预览命中样本，生效后仅处理有效期内的新财务事实。' : '修复建议提交审批前不写账，批准后只追加冲正与替换分录。'}
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={<div className="governanceactions">{model.view === 'policies' && model.can.policyManage ? <Button tone="primary" onPress={model.actions.createPolicy}>新建政策</Button> : null}{model.view === 'repairs' && model.can.repairSubmit ? <Button tone="primary" onPress={model.actions.createRepair}>创建修复建议</Button> : null}<Button onPress={model.actions.refresh} isDisabled={model.fetching}>{model.fetching ? '刷新中…' : '刷新'}</Button></div>}
        notice={<section className="governancenotice"><strong>复式记账与经办复核分离</strong><p>借贷必须平衡、币种不可混算、关账期间不可直接写入；人工修复必须由另一名复核人审批。</p></section>}
      >
        {model.view === 'policies' ? <PolicyTable model={model} /> : <RepairTable model={model} />}
        <footer className="governancepagination"><span>服务端共 {page?.count ?? 0} 条</span><div>{model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}{page?.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}</div></footer>
      </ResourcePanel>
      <PolicyDialog model={model} />
      <RepairDialog model={model} />
    </section>
  );
}

function PolicyTable({ model }: Readonly<{ model: PolicyViewModel }>) {
  const columns: readonly DataColumn<FinancePolicy>[] = [
    { key: 'name', label: '政策', render: (row) => <div className="governanceprimary"><strong>{row.name}</strong><span>{row.trigger}</span></div> },
    { key: 'entries', label: '复式分录', render: (row) => `${row.entries.length} 条 · ${row.entries[0]?.currency ?? 'CNY'}` },
    { key: 'effective', label: '有效期', render: (row) => `${formatDate(row.effectiveAt)} 至 ${row.expiresAt ? formatDate(row.expiresAt) : '长期有效'}` },
    { key: 'state', label: '状态', render: (row) => <Status tone={row.status === 'active' ? 'success' : row.status === 'draft' ? 'warning' : 'neutral'}>{chineseDomainLabel(row.status)}</Status> },
    { key: 'version', label: '版本', render: (row) => `v${row.version}` },
    ...(model.can.policyManage ? [{ key: 'actions', label: '操作', render: (row: FinancePolicy) => <div className="governanceactions"><Button onPress={() => model.actions.editPolicy(row)}>修订</Button>{row.status !== 'retired' ? <Button tone="danger" onPress={() => model.actions.retirePolicy(row)}>停用</Button> : null}</div> } satisfies DataColumn<FinancePolicy>] : []),
  ];
  return <DataTable caption="财务政策" rows={model.policies?.items ?? []} columns={columns} rowKey={(row) => row.id} />;
}

function RepairTable({ model }: Readonly<{ model: PolicyViewModel }>) {
  const columns: readonly DataColumn<FinanceRepair>[] = [
    { key: 'statement', label: '账单与修复', render: (row) => <div className="governanceprimary"><strong>{chineseReference('账单', row.statementId)}</strong><span>{row.reason}</span></div> },
    { key: 'difference', label: '差异', render: (row) => row.differences.length === 0 ? '未返回明细' : `${row.differences.length} 项 · ${formatMinor(row.differences.reduce((total, item) => total + item.deltaMinor, 0), row.differences[0]?.currency ?? 'CNY')}` },
    { key: 'state', label: '状态', render: (row) => <Status tone={row.status === 'approved' ? 'success' : row.status === 'rejected' || row.status === 'reversed' ? 'danger' : 'warning'}>{chineseDomainLabel(row.status)}</Status> },
    { key: 'roles', label: '经办 / 复核', render: (row) => <div className="governanceprimary"><span>{chineseReference('经办人', row.makerId)}</span><span>{row.checkerId ? chineseReference('复核人', row.checkerId) : '等待独立复核'}</span></div> },
    { key: 'journals', label: '落账结果', render: (row) => row.replacementJournalId ? '已追加冲正与替换凭证' : row.rollbackJournalId ? '已追加回滚凭证' : '尚未写账' },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    { key: 'actions', label: '操作', render: (row) => <div className="governanceactions"><Button onPress={() => model.actions.reviewRepair(row)}>{row.status === 'submitted' ? '复核详情' : '查看详情'}</Button>{row.status === 'approved' && model.can.repairReverse ? <Button tone="danger" onPress={() => model.actions.reverseRepair(row)}>追加回滚</Button> : null}</div> },
  ];
  return <DataTable caption="对账修复" rows={model.repairs?.items ?? []} columns={columns} rowKey={(row) => row.id} />;
}
