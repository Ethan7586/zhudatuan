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

export function SupportContextPanel({ selectedCase, caseId }: Readonly<{
  selectedCase?: SupportCase;
  caseId?: string;
}>) {
  return (
    <aside className="supportcontext" aria-label="工单上下文">
      <div className="supportpanelheading"><div><span>工单上下文</span></div></div>
      {selectedCase === undefined ? <ContextEmpty {...(caseId === undefined ? {} : { caseId })} /> : <>
        <section className="supportcontextsummary">
          <span className="supportcontextavatar" aria-hidden="true">{selectedCase.subject.trim().slice(0, 1) || '工'}</span>
          <h2>{selectedCase.subject}</h2>
          <p>{shortIdentifier(selectedCase.id)}</p>
          <div><span data-tone={supportTone(selectedCase.priority)}>{supportPriorityLabel(selectedCase.priority)}</span>
            <span data-tone={supportTone(selectedCase.state)}>{supportStateLabel(selectedCase.state)}</span></div>
        </section>
        <ContextSection title="处理信息">
          <ContextRow label="会员身份" value={selectedCase.member_id ?? '未关联'} />
          <ContextRow label="接入渠道" value={supportChannelLabel(selectedCase.channel)} />
          <ContextRow label="技能组" value={selectedCase.skill} />
          <ContextRow label="当前坐席" value={selectedCase.assigned_agent_id ?? '待分配'} />
          <ContextRow label="关联订单" value={selectedCase.order_id ?? '未关联'} />
        </ContextSection>
        <ContextSection title="SLA 时间">
          <ContextTime label="响应期限" value={selectedCase.response_due_at} />
          <ContextTime label="解决期限" value={selectedCase.resolution_due_at} />
          <ContextTime label="最近更新" value={selectedCase.updated_at} />
        </ContextSection>
        <ContextSection title="系统记录">
          <ContextRow label="会话 ID" value={shortIdentifier(selectedCase.conversation_id)} />
          <ContextRow label="工单版本" value={`v${selectedCase.version}`} />
          <ContextTime label="创建时间" value={selectedCase.created_at} />
        </ContextSection>
        <section className="supportcontextboundary" aria-label="尚未接入的客服能力">
          <strong>扩展能力</strong>
          <p>语音通话、附件、转接和关闭工单将在各自的服务端能力闭合后开放。</p>
          <div><button type="button" disabled>语音通话</button><button type="button" disabled>转接坐席</button></div>
        </section>
      </>}
    </aside>
  );
}

function ContextSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <section className="supportcontextsection"><h3>{title}</h3><dl>{children}</dl></section>;
}

function ContextRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt>{label}</dt><dd title={value}>{value}</dd></div>;
}

function ContextTime({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return <div><dt>{label}</dt><dd>{value === null ? '未设置' : <time dateTime={value}>{supportTime(value)}</time>}</dd></div>;
}

function ContextEmpty({ caseId }: Readonly<{ caseId?: string }>) {
  return <div className="supportcontextempty"><span aria-hidden="true">◎</span><strong>{caseId === undefined ? '尚未选择工单' : '当前页无工单详情'}</strong>
    <p>{caseId === undefined ? '打开一条工单后，这里会显示坐席、订单和 SLA 信息。' : '会话仍可读取；返回队列首页可重新定位工单。'}</p></div>;
}
