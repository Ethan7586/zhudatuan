import { useEffect, useState, type ReactNode } from 'react';
import type { SupportAgent, SupportCase, SupportHistory } from './SupportSchema';
import {
  shortIdentifier,
  supportChannelLabel,
  supportHistoryLabel,
  supportPriorityGrade,
  supportPriorityGuidance,
  supportPriorityLabel,
  supportStateLabel,
  supportTime,
  supportTone,
  type SupportPriorityGrade,
} from './SupportPresentation';

export function SupportContextPanel({ brandName, selectedCase, caseId, agents, canAssign, canEscalate, canAdvance, actionPending,
  actionError, canReview, reviewing, reviewError, history, onAssign, onEscalate, onAdvance, onReview }: Readonly<{
  brandName: string;
  selectedCase?: SupportCase;
  caseId?: string;
  agents: readonly SupportAgent[];
  canAssign: boolean;
  canEscalate: boolean;
  canAdvance: boolean;
  actionPending: boolean;
  actionError?: string;
  canReview: boolean;
  reviewing: boolean;
  reviewError?: string;
  history: readonly SupportHistory[];
  onAssign: (agent: string) => Promise<void>;
  onEscalate: () => Promise<void>;
  onAdvance: () => Promise<void>;
  onReview: (grade: SupportPriorityGrade) => Promise<void>;
}>) {
  return (
    <aside className="supportcontext" aria-label="工单上下文">
      <div className="supportpanelheading"><div><span>工单上下文</span></div></div>
      {selectedCase === undefined ? <ContextEmpty {...(caseId === undefined ? {} : { caseId })} /> : <>
        <ContextSection>
          <ContextRow label="受理商城" value={brandName} strong />
          <ContextRow label="当前责任方" value={selectedCase.assigned_agent_id === null ? '待分配' : shortIdentifier(selectedCase.assigned_agent_id)} />
          <ContextRow label="关联订单" value={selectedCase.order?.number ?? selectedCase.order_id ?? '未关联'} />
          <ContextRow label="订单状态" value={selectedCase.order === null || selectedCase.order === undefined ? '不适用' : orderStateLabel(selectedCase.order.state)} />
          <ContextRow label="退款状态" value={selectedCase.order === null || selectedCase.order === undefined ? '不适用' : paymentStateLabel(selectedCase.order.paymentState)} tone="warning" />
          <ContextRow label="物流状态" value={selectedCase.order === null || selectedCase.order === undefined ? '不适用' : fulfillmentStateLabel(selectedCase.order.fulfillmentState)} tone="success" />
          <ContextRow label="SLA" value={slaLabel(selectedCase)} tone="warning" />
        </ContextSection>
        <ContextSection title="用户信息">
          <div className="supportcontextidentity">发起人</div>
          <ContextRow label="用户标识" value={selectedCase.member_id === null || selectedCase.member_id === undefined ? '匿名/系统' : shortIdentifier(selectedCase.member_id)} />
          <ContextRow label="手机号码" value="未向工单暴露" />
          <ContextRow label="会员等级" value="由会员中心管理" />
        </ContextSection>
        <ContextSection title="工单信息">
          <ContextTime label="创建时间" value={selectedCase.created_at} />
          <ContextRow label="工单编号" value={`#${shortIdentifier(selectedCase.id)}`} />
          <ContextRow label="问题分类" value={selectedCase.skill} />
          <ContextRow label="来源渠道" value={supportChannelLabel(selectedCase.channel)} />
          <ContextRow label="优先级" value={supportPriorityLabel(selectedCase.priority)} tone={supportTone(selectedCase.priority)} />
          <ContextRow label="当前状态" value={supportStateLabel(selectedCase.state)} tone={supportTone(selectedCase.state)} />
          <ContextRow label="标签" value="暂无" />
        </ContextSection>
        <PriorityReview priority={selectedCase.priority} canReview={canReview} reviewing={reviewing}
          {...(reviewError === undefined ? {} : { error: reviewError })} onReview={onReview} />
        <HistoryTimeline items={history} />
        <WorkflowActions caseId={selectedCase.id} state={selectedCase.state} agents={agents} canAssign={canAssign}
          canEscalate={canEscalate} canAdvance={canAdvance} pending={actionPending}
          {...(actionError === undefined ? {} : { error: actionError })} onAssign={onAssign} onEscalate={onEscalate} onAdvance={onAdvance} />
      </>}
    </aside>
  );
}

function WorkflowActions({ caseId, state, agents, canAssign, canEscalate, canAdvance, pending, error, onAssign, onEscalate,
  onAdvance }: Readonly<{ caseId: string; state: string; agents: readonly SupportAgent[]; canAssign: boolean; canEscalate: boolean;
    canAdvance: boolean; pending: boolean; error?: string; onAssign: (agent: string) => Promise<void>;
    onEscalate: () => Promise<void>; onAdvance: () => Promise<void> }>) {
  const [agent, setAgent] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => { setAgent(''); setConfirmClose(false); }, [caseId, state]);
  const normalized = state.toLowerCase();
  const advanceLabel = normalized === 'resolved' ? (confirmClose ? '再次确认关闭' : '关闭工单')
    : normalized === 'closed' ? '重新打开' : '完成工单';
  const advance = () => {
    if (normalized === 'resolved' && !confirmClose) { setConfirmClose(true); return; }
    void onAdvance();
  };
  return <section className="supportcontextactions" aria-labelledby="supportactiontitle">
    <strong id="supportactiontitle">操作</strong>
    <label><span>转交处理人</span><select aria-label="转交处理人" value={agent} disabled={!canAssign || pending}
      onChange={(event) => setAgent(event.target.value)}><option value="">请选择可用坐席</option>
      {agents.filter(({ state: agentState }) => agentState === 'available').map((item) =>
        <option key={item.id} value={item.id}>{shortIdentifier(item.membership_id)} · {item.capacity} 容量</option>)}</select></label>
    <div>
      <button type="button" disabled={!canAssign || pending || agent.length === 0} onClick={() => { void onAssign(agent); }}>确认转交</button>
      <button type="button" disabled={!canEscalate || pending} onClick={() => { void onEscalate(); }}>升级至平台支持</button>
      <button type="button" disabled={!canAdvance || pending} onClick={advance}>{pending ? '处理中…' : advanceLabel}</button>
    </div>
    <p role="status" aria-live="polite">{error ?? (!canAssign && !canEscalate && !canAdvance ? '当前身份没有工单操作权限' : '所有操作都会写入工单记录')}</p>
  </section>;
}

function PriorityReview({ priority, canReview, reviewing, error, onReview }: Readonly<{
  priority: string;
  canReview: boolean;
  reviewing: boolean;
  error?: string;
  onReview: (grade: SupportPriorityGrade) => Promise<void>;
}>) {
  const current = supportPriorityGrade(priority);
  const [grade, setGrade] = useState<SupportPriorityGrade>(current);
  useEffect(() => setGrade(current), [current]);
  return <section className="supportpriorityreview" aria-labelledby="supportprioritytitle">
    <h3 id="supportprioritytitle">P 级审核</h3>
    <label><span>影响等级</span><select value={grade} disabled={!canReview || reviewing}
      onChange={(event) => setGrade(event.target.value as SupportPriorityGrade)}>
      <option value="P0">P0 · 立即响应</option><option value="P1">P1 · 优先处理</option>
      <option value="P2">P2 · 标准处理</option><option value="P3">P3 · 计划处理</option>
    </select></label>
    <p>{supportPriorityGuidance(grade)}</p>
    <button type="button" disabled={!canReview || reviewing} onClick={() => { void onReview(grade); }}>
      {reviewing ? '保存中…' : `确认定为 ${grade}`}
    </button>
    <span role="status" aria-live="polite">{error ?? (!canReview ? '当前身份没有工单定级权限' : '')}</span>
  </section>;
}

function HistoryTimeline({ items }: Readonly<{ items: readonly SupportHistory[] }>) {
  return <section className="supporthistory" aria-labelledby="supporthistorytitle"><h3 id="supporthistorytitle">操作记录</h3>
    {items.length === 0 ? <p>暂无可显示的审核记录</p> : <ol>{items.slice(-8).reverse().map((item) => <li key={item.sequence}>
      <i aria-hidden="true" /><div><strong>{supportHistoryLabel(item.kind)}</strong><time dateTime={item.occurred_at}>{supportTime(item.occurred_at)}</time>
        <span>{historyDetail(item)}</span></div></li>)}</ol>}
  </section>;
}

function historyDetail(item: SupportHistory): string {
  if (item.evidence === null || typeof item.evidence !== 'object' || Array.isArray(item.evidence)) return `操作人 ${shortIdentifier(item.actor_id ?? '系统')}`;
  const evidence = item.evidence as Record<string, unknown>;
  if (item.kind === 'priority.reviewed' && typeof evidence.priority === 'string') {
    return `${supportPriorityGrade(evidence.priority)} · ${supportPriorityLabel(evidence.priority)}`;
  }
  if (item.kind === 'attachment.uploaded' && typeof evidence.name === 'string') return evidence.name;
  if ((item.kind === 'assigned' || item.kind === 'reassigned') && typeof evidence.agent === 'string') return `处理人 ${shortIdentifier(evidence.agent)}`;
  if (item.kind === 'platform.escalated') return '目标：平台支持';
  return `操作人 ${shortIdentifier(item.actor_id ?? '系统')}`;
}

function orderStateLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = { active: '进行中', cancelled: '已取消', completed: '已完成', pending: '待处理' };
  return labels[value.toLowerCase()] ?? value;
}

function paymentStateLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = { unpaid: '未支付', paid: '未退款', partially_refunded: '部分退款',
    refunded: '已退款', cancelled: '已取消' };
  return labels[value.toLowerCase()] ?? value;
}

function fulfillmentStateLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = { pending: '待履约', allocated: '待发货', shipped: '运输中',
    delivered: '已送达', completed: '已完成', cancelled: '已取消' };
  return labels[value.toLowerCase()] ?? value;
}

function slaLabel(ticket: SupportCase): string {
  if (ticket.response_due_at === null && ticket.resolution_due_at === null) return '暂无策略';
  if (ticket.response_due_at !== null) return `响应 ${supportTime(ticket.response_due_at)}`;
  return `解决 ${supportTime(ticket.resolution_due_at)}`;
}

function ContextSection({ title, children }: Readonly<{ title?: string; children: ReactNode }>) {
  return <section className="supportcontextsection">{title === undefined ? null : <h3>{title}</h3>}<dl>{children}</dl></section>;
}

function ContextRow({ label, value, strong = false, tone }: Readonly<{
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'danger' | 'muted' | 'success' | 'warning';
}>) {
  return <div><dt>{label}</dt><dd title={value} data-strong={strong ? 'true' : undefined} data-tone={tone}>{value}</dd></div>;
}

function ContextTime({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return <div><dt>{label}</dt><dd>{value === null ? '暂无' : <time dateTime={value}>{supportTime(value)}</time>}</dd></div>;
}

function ContextEmpty({ caseId }: Readonly<{ caseId?: string }>) {
  return <div className="supportcontextempty"><span aria-hidden="true">◎</span><strong>{caseId === undefined ? '尚未选择工单' : '当前页无工单详情'}</strong>
    <p>{caseId === undefined ? '打开一条工单后，这里会显示订单、SLA 与工单信息。' : '会话仍可读取；返回队列首页可重新定位工单。'}</p></div>;
}
