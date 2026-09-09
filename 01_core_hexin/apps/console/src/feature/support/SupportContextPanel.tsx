import type { ReactNode } from 'react';
import type { SupportCase } from './SupportSchema';
import {
  shortIdentifier,
  supportChannelLabel,
  supportPriorityLabel,
  supportStateLabel,
  supportTime,
  supportTone,
} from './SupportPresentation';

export function SupportContextPanel({ brandName, selectedCase, caseId }: Readonly<{
  brandName: string;
  selectedCase?: SupportCase;
  caseId?: string;
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
