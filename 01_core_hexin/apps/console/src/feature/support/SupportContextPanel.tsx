import { useEffect, useState, type ReactNode } from 'react';
import type { SupportCase, SupportHistory } from './SupportSchema';
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

export function SupportContextPanel({ brandName, selectedCase, caseId, canReview, reviewing, reviewError, history, onReview }: Readonly<{
  brandName: string;
  selectedCase?: SupportCase;
  caseId?: string;
  canReview: boolean;
  reviewing: boolean;
  reviewError?: string;
  history: readonly SupportHistory[];
  onReview: (grade: SupportPriorityGrade) => Promise<void>;
}>) {
  return (
    <aside className="supportcontext" aria-label="工单上下文">
      <div className="supportpanelheading"><div><span>工单上下文</span></div></div>
      {selectedCase === undefined ? <ContextEmpty {...(caseId === undefined ? {} : { caseId })} /> : <>
        <ContextSection>
          <ContextRow label="受理商城" value={brandName} strong />
          <ContextRow label="当前责任方" value="待接入" />
          <ContextRow label="关联订单" value={selectedCase.order_id ?? '未关联'} />
          <ContextRow label="退款状态" value="待接入" tone="warning" />
          <ContextRow label="物流状态" value="待接入" tone="success" />
          <ContextRow label="SLA" value={selectedCase.response_due_at === null ? '暂无' : `响应期限 ${supportTime(selectedCase.response_due_at)}`} tone="warning" />
        </ContextSection>
        <ContextSection title="用户信息">
          <div className="supportcontextidentity">发起人</div>
          <ContextRow label="用户昵称" value="暂无" />
          <ContextRow label="手机号码" value="暂无" />
          <ContextRow label="会员等级" value="待接入" />
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
        <section className="supportcontextactions" aria-label="下一批接入的工单操作">
          <strong>操作</strong>
          <div>
            <button type="button" disabled title="下一批接入">转交</button>
            <button type="button" disabled title="下一批接入">升级至平台支持</button>
            <button type="button" disabled title="下一批接入">完成工单</button>
          </div>
          <p>以上操作将在下一批接入</p>
        </section>
      </>}
    </aside>
  );
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
  return `操作人 ${shortIdentifier(item.actor_id ?? '系统')}`;
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
