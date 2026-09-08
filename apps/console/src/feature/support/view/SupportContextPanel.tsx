import { Button } from '@shop/design';
import { chineseDomainLabel, chineseDomainList, chineseReference } from '@shop/presentation';
import { useState } from 'react';
import type { Agent } from '../model/Agent';
import type { SupportContext } from '../model/SupportContext';
import type { Ticket } from '../model/Ticket';
import { channelLabel, formatTime, priorityLabel, shortId, stateLabel, tone } from './SupportPresentation';

export function SupportContextPanel({
  open,
  ticket,
  context,
  agents,
  busy,
  error,
  onDismiss,
  onClose,
  onReopen,
  onAssign,
  onHistory,
  canAssign,
  assignmentReady,
  canClose,
  canReopen,
  canReadHistory,
  canOpenOrder,
  onOrder,
  onVerify,
}: Readonly<{
  open: boolean;
  ticket?: Ticket | undefined;
  context?: SupportContext | undefined;
  agents: readonly Agent[];
  busy: boolean;
  error?: string | undefined;
  onDismiss: () => void;
  onClose: () => void;
  onReopen: () => void;
  onAssign: (agent: string, reason: string) => void;
  onHistory: () => void;
  canAssign: boolean;
  assignmentReady: boolean;
  canClose: boolean;
  canReopen: boolean;
  canReadHistory: boolean;
  canOpenOrder: boolean;
  onOrder: (order: string) => void;
  onVerify: () => void;
}>) {
  const [agent, setAgent] = useState('');
  const [reason, setReason] = useState('');
  return (
    <aside className="supportcontext" data-open={open} aria-label="用户与业务上下文">
      <header className="supportpanelheader">
        <div>
          <strong>用户与业务上下文</strong>
        </div>
        <Button className="supportcontextdismiss" onPress={onDismiss} aria-label="关闭用户与业务上下文">
          ×
        </Button>
      </header>
      {!ticket || !context ? (
        <div className="supportcontextempty">
          <span>◎</span>
          <strong>尚未选择工单</strong>
          <p>打开工单后查看用户、订单、权益、服务时限与分配记录。</p>
        </div>
      ) : (
        <div className="supportcontextbody">
          <section className="supportcontextsummary">
            <span>{ticket.subject.trim().slice(0, 1) || '工'}</span>
            <h2>{ticket.subject}</h2>
            <p>{shortId(ticket.id)}</p>
            <div>
              <em data-tone={tone(ticket.priority)}>{priorityLabel(ticket.priority)}</em>
              <em data-tone={tone(ticket.state)}>{stateLabel(ticket.state)}</em>
            </div>
          </section>
          {error ? (
            <p className="supportactionerror" role="alert">
              {error}
            </p>
          ) : null}
          <ContextSection title="员工资料">
            <Row label="姓名" value={context.member.displayName} />
            <Row label="员工编号" value={context.member.employeeNo ?? '未设置'} />
            <Row label="手机号" value={context.member.mobileMasked ?? '未绑定'} />
            <Row label="组织" value={chineseReference('组织', context.organization.id)} />
            <Row label="渠道" value={channelLabel(ticket.channel)} />
          </ContextSection>
          <ContextSection title="最近订单">
            {context.orders.length ? context.orders.map((order) => <OrderRow key={order.id} order={order} openable={canOpenOrder} onOpen={onOrder} />) : <Row label="订单" value="暂无订单" />}
          </ContextSection>
          <ContextSection title="福利权益">
            {context.benefits.length ? (
              context.benefits.map((benefit) => <Row key={benefit.id} label={chineseDomainLabel(benefit.kind, '福利权益')} value={`${chineseDomainLabel(benefit.state)} · ${money(benefit.remainingMinor, benefit.currency)}`} />)
            ) : (
              <Row label="权益" value="暂无权益" />
            )}
          </ContextSection>
          <ContextSection title="处理与服务时限">
            <Row label="技能组" value={chineseDomainLabel(ticket.skill, '专属服务')} />
            <Row label="当前客服" value={ticket.assignedAgentName ?? (ticket.assignedAgentId ? '已分配客服' : '待分配')} />
            <Time label="响应期限" value={ticket.responseDueAt} />
            <Time label="解决期限" value={ticket.resolutionDueAt} />
          </ContextSection>
          {canAssign ? <section className="supportcontextsection">
            <h3>转派工单</h3>
            {assignmentReady ? <div className="supportassign">
              <select aria-label="目标客服" value={agent} onChange={(event) => setAgent(event.target.value)} disabled={busy}>
                <option value="">选择可用客服</option>
                {agents
                  .filter((item) => item.state === 'available')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} · {chineseDomainList(item.skills, '专属服务') || '通用服务'}
                    </option>
                  ))}
              </select>
              <textarea aria-label="转派原因" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="填写转派原因" maxLength={500} disabled={busy} />
              <Button onPress={() => onAssign(agent, reason)} isDisabled={busy || !agent || reason.trim().length < 4}>
                确认转派
              </Button>
            </div> : <div className="supportassignverify"><p>转派会改变当前负责人，请先完成短信二次验证。</p><Button onPress={onVerify}>验证身份后转派</Button></div>}
          </section> : null}
          <section className="supportcontextactions">
            {canReadHistory ? <Button onPress={onHistory}>查看完整历史</Button> : null}
            {ticket.state === 'closed' && canReopen ? (
              <Button tone="primary" onPress={onReopen} isDisabled={busy}>
                重新打开
              </Button>
            ) : ticket.state !== 'closed' && canClose ? (
              <Button tone="danger" onPress={onClose} isDisabled={busy}>
                关闭工单
              </Button>
            ) : null}
          </section>
        </div>
      )}
    </aside>
  );
}

function ContextSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="supportcontextsection">
      <h3>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}
function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}
function Time({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <time dateTime={value}>{formatTime(value)}</time>
      </dd>
    </div>
  );
}
function OrderRow({ order, openable, onOpen }: Readonly<{ order: SupportContext['orders'][number]; openable: boolean; onOpen: (order: string) => void }>) {
  return (
    <div>
      <dt>{order.number}</dt>
      <dd>
        {chineseDomainLabel(order.state)} · {money(order.totalMinor)}
        {openable ? <button type="button" className="supportorderlink" onClick={() => onOpen(order.id)}>查看订单</button> : null}
      </dd>
    </div>
  );
}
function money(value: number, currency = 'CNY'): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value / 100);
}
